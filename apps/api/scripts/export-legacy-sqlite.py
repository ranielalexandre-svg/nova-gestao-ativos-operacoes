#!/usr/bin/env python3
"""Export legacy SQLite databases into a normalized JSON bundle.

The bundle is intentionally file-based so this migration step can preserve
legacy details without expanding the Prisma schema. Starlink passwords are
redacted by default; pass --include-secrets only when exporting to a secure
runtime location.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sqlite3
import unicodedata
from pathlib import Path
from typing import Any


STATE_MAP = {
    "ACRE": "AC",
    "ALAGOAS": "AL",
    "AMAPA": "AP",
    "AMAZONAS": "AM",
    "BAHIA": "BA",
    "CEARA": "CE",
    "DISTRITO FEDERAL": "DF",
    "ESPIRITO SANTO": "ES",
    "GOIAS": "GO",
    "MARANHAO": "MA",
    "MATO GROSSO": "MT",
    "MATO GROSSO DO SUL": "MS",
    "MINAS GERAIS": "MG",
    "PARA": "PA",
    "PARAIBA": "PB",
    "PARANA": "PR",
    "PERNAMBUCO": "PE",
    "PIAUI": "PI",
    "RIO DE JANEIRO": "RJ",
    "RIO GRANDE DO NORTE": "RN",
    "RIO GRANDE DO SUL": "RS",
    "RONDONIA": "RO",
    "RORAIMA": "RR",
    "SANTA CATARINA": "SC",
    "SAO PAULO": "SP",
    "SERGIPE": "SE",
    "TOCANTINS": "TO",
}


def clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def ascii_fold(value: str) -> str:
    return (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
    )


def slug(value: str, fallback: str, limit: int = 48) -> str:
    folded = ascii_fold(value or fallback).upper()
    folded = re.sub(r"[^A-Z0-9]+", "-", folded).strip("-")
    folded = re.sub(r"-+", "-", folded)
    return (folded or fallback)[:limit].strip("-")


def norm(value: str) -> str:
    folded = ascii_fold(value).lower()
    return re.sub(r"[^a-z0-9]+", "", folded)


def rows(path: Path, table: str) -> list[dict[str, Any]]:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in con.execute(f'select * from "{table}"')]
    finally:
        con.close()


def parse_city(value: str) -> tuple[str, str]:
    parts = [part.strip() for part in value.split(",") if part.strip()]
    city = parts[0] if parts else ""
    state = ""

    for part in parts[1:]:
        folded = ascii_fold(part).upper()
        if len(folded) == 2 and folded.isalpha():
            state = folded
            break
        if folded in STATE_MAP:
            state = STATE_MAP[folded]
            break

    return city, state


def parse_starlink_local(value: str) -> tuple[str, str]:
    raw = clean(value)
    if not raw:
        return "", ""

    match = re.match(r"^\((\d+),\s*['\"](.+)['\"]\)$", raw)
    if not match:
        return "", raw

    return match.group(1), match.group(2).strip()


def redacted_row(row: dict[str, Any], include_secrets: bool) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in row.items():
        if not include_secrets and any(secret in key.lower() for secret in ["senha", "password", "token", "secret"]):
            out[key] = "<redacted>" if clean(value) else ""
        else:
            out[key] = value
    return out


def add_partner(partners: dict[str, dict[str, Any]], name: str) -> str:
    code = slug(name, "SEM-PARCEIRO", 32)
    if code not in partners:
        partners[code] = {
            "code": code,
            "name": name or code,
            "contacts": [],
            "legacyContactIds": [],
            "primaryUnitCount": 0,
            "backupUnitCount": 0,
        }
    return code


def contact_link(row: dict[str, Any], prefix: str = "") -> dict[str, Any]:
    suffix = f"_{prefix}" if prefix else ""
    return {
        "legacyId": clean(row.get("id")),
        "serviceType": clean(row.get(f"tipo_servico{suffix}")),
        "connectionType": clean(row.get(f"tipo_conexao{suffix}")),
        "routerPort": clean(row.get(f"porta_rb{suffix}")),
        "technology": clean(row.get(f"tecnologia{suffix}")),
        "latency": clean(row.get(f"latencia{suffix}")),
        "macOnu": clean(row.get(f"mac_onu{suffix}")),
        "phone": clean(row.get("numero")),
        "notes": clean(row.get(f"observacoes{suffix}")),
        "contractIxc": clean(row.get("contrato_ixc")),
    }


def build_bundle(
    contatos_path: Path,
    parceiros_path: Path,
    starlinks_path: Path,
    include_secrets: bool,
) -> dict[str, Any]:
    contatos = rows(contatos_path, "contatos")
    parceiros_rows = rows(parceiros_path, "parceiros")
    starlinks_rows = rows(starlinks_path, "starlinks")
    historico_rows = rows(starlinks_path, "historico_starlink")

    partners: dict[str, dict[str, Any]] = {}
    units: dict[str, dict[str, Any]] = {}
    unit_by_contact_id: dict[str, str] = {}
    unit_by_norm_name: dict[str, str] = {}
    equipments: dict[str, dict[str, Any]] = {}

    for row in contatos:
        group = clean(row.get("grupo"))
        unit_name = clean(row.get("unidade"))
        city, state = parse_city(clean(row.get("cidade")))
        primary_partner = clean(row.get("nome_parceiro"))
        backup_partner = clean(row.get("nome_parceiro_bkp"))
        partner_code = add_partner(partners, primary_partner or "Sem parceiro")
        unit_code = f"{slug(group, 'GRP', 14)}-{slug(unit_name, 'UNIDADE', 42)}"
        unit_key = f"{norm(group)}::{norm(unit_name)}::{norm(city)}"

        if unit_key not in units:
            units[unit_key] = {
                "key": unit_key,
                "code": unit_code,
                "name": unit_name,
                "group": group,
                "city": city,
                "state": state,
                "partnerCode": partner_code,
                "legacyContactIds": [],
                "links": [],
                "backupLinks": [],
                "phones": [],
                "contracts": [],
                "notes": [],
            }

        unit = units[unit_key]
        legacy_id = clean(row.get("id"))
        unit["legacyContactIds"].append(legacy_id)
        unit_by_contact_id[legacy_id] = unit_key
        unit_by_norm_name[norm(unit_name)] = unit_key

        link = contact_link(row)
        link["partnerCode"] = partner_code
        unit["links"].append(link)
        partners[partner_code]["primaryUnitCount"] += 1
        partners[partner_code]["legacyContactIds"].append(legacy_id)

        phone = clean(row.get("numero"))
        if phone and phone not in unit["phones"]:
            unit["phones"].append(phone)

        contract = clean(row.get("contrato_ixc"))
        if contract and contract not in unit["contracts"]:
            unit["contracts"].append(contract)

        notes = clean(row.get("observacoes"))
        if notes and notes not in unit["notes"]:
            unit["notes"].append(notes)

        mac_onu = clean(row.get("mac_onu"))
        if mac_onu:
            tag = f"ONU-{unit_code}-{len(unit['links']):02d}"[:64]
            equipments[tag] = {
                "tag": tag,
                "name": f"ONU {unit_name}",
                "type": "onu",
                "serialNumber": mac_onu,
                "status": "active",
                "unitKey": unit_key,
                "unitCode": unit_code,
                "partnerCode": partner_code,
                "source": "contatos.mac_onu",
                "legacyId": legacy_id,
            }

        if backup_partner:
            backup_code = add_partner(partners, backup_partner)
            backup_link = contact_link(row, "bkp")
            backup_link["partnerCode"] = backup_code
            unit["backupLinks"].append(backup_link)
            partners[backup_code]["backupUnitCount"] += 1

    for row in parceiros_rows:
        partner_name = clean(row.get("parceiro"))
        partner_code = add_partner(partners, partner_name or "Sem parceiro")
        partners[partner_code]["contacts"].append(
            {
                "legacyId": clean(row.get("id")),
                "city": clean(row.get("cidade")),
                "name": clean(row.get("nome_contato")),
                "role": clean(row.get("cargo")),
                "phone": clean(row.get("numero")),
                "notes": clean(row.get("observacoes")),
            }
        )

    starlinks: list[dict[str, Any]] = []
    for row in starlinks_rows:
        local_id, local_name = parse_starlink_local(clean(row.get("local")))
        unit_key = unit_by_contact_id.get(local_id) or unit_by_norm_name.get(norm(local_name), "")
        id_antena = clean(row.get("id_antena"))
        tag = f"STARLINK-{slug(id_antena or clean(row.get('id')), 'SEM-ID', 24)}"
        serial = clean(row.get("sn_kit")) or clean(row.get("snantena"))
        starlink = {
            "legacyId": clean(row.get("id")),
            "antennaId": id_antena,
            "email": clean(row.get("email")),
            "password": clean(row.get("senha")) if include_secrets else "<redacted>",
            "plan": clean(row.get("plano")),
            "card": clean(row.get("cartao")),
            "localRaw": clean(row.get("local")),
            "localLegacyContactId": local_id,
            "localName": local_name,
            "unitKey": unit_key,
            "kitSerial": clean(row.get("sn_kit")),
            "antennaSerial": clean(row.get("snantena")),
            "ipvpn": clean(row.get("ipvpn")),
            "installer": clean(row.get("instalador")),
            "installedAt": clean(row.get("data_instalacao")),
            "notes": clean(row.get("observacoes_starlink")),
        }
        starlinks.append(starlink)

        if serial:
            equipments[tag] = {
                "tag": tag,
                "name": f"Starlink {local_name or id_antena or clean(row.get('id'))}",
                "type": "starlink",
                "serialNumber": serial,
                "status": "active" if unit_key else "stock",
                "unitKey": unit_key,
                "unitCode": units.get(unit_key, {}).get("code", ""),
                "partnerCode": "STARLINK",
                "source": "starlinks",
                "legacyId": clean(row.get("id")),
            }

    history = [
        {
            "legacyId": clean(row.get("id")),
            "starlinkLegacyId": clean(row.get("starlink_id")),
            "action": clean(row.get("acao")),
            "details": clean(row.get("detalhes")),
            "user": clean(row.get("user")),
            "datetime": clean(row.get("datetime")),
        }
        for row in historico_rows
    ]

    units_list = sorted(units.values(), key=lambda item: item["code"])
    partners_list = sorted(partners.values(), key=lambda item: item["code"])
    equipments_list = sorted(equipments.values(), key=lambda item: item["tag"])

    return {
        "version": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "redactedSecrets": not include_secrets,
        "sources": {
            "contatos": str(contatos_path),
            "parceiros": str(parceiros_path),
            "starlinks": str(starlinks_path),
        },
        "summary": {
            "raw": {
                "contatos": len(contatos),
                "parceiros": len(parceiros_rows),
                "starlinks": len(starlinks_rows),
                "starlinkHistory": len(historico_rows),
            },
            "normalized": {
                "partners": len(partners_list),
                "units": len(units_list),
                "equipments": len(equipments_list),
                "starlinksInstalled": sum(1 for item in starlinks if item["unitKey"]),
                "contactsWithBackup": sum(1 for item in contatos if clean(item.get("nome_parceiro_bkp"))),
                "contactsWithMacOnu": sum(1 for item in contatos if clean(item.get("mac_onu"))),
            },
        },
        "normalized": {
            "partners": partners_list,
            "units": units_list,
            "equipments": equipments_list,
            "starlinks": starlinks,
            "starlinkHistory": history,
        },
        "raw": {
            "contatos": [redacted_row(row, include_secrets) for row in contatos],
            "parceiros": [redacted_row(row, include_secrets) for row in parceiros_rows],
            "starlinks": [redacted_row(row, include_secrets) for row in starlinks_rows],
            "starlinkHistory": [redacted_row(row, include_secrets) for row in historico_rows],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Export NOVA legacy SQLite data.")
    parser.add_argument("--contatos", required=True, type=Path)
    parser.add_argument("--parceiros", required=True, type=Path)
    parser.add_argument("--starlinks", required=True, type=Path)
    parser.add_argument("--output", default=Path(".run-logs/legacy-import.json"), type=Path)
    parser.add_argument("--include-secrets", action="store_true")
    args = parser.parse_args()

    bundle = build_bundle(args.contatos, args.parceiros, args.starlinks, args.include_secrets)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"output": str(args.output), **bundle["summary"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
