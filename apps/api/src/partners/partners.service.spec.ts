jest.mock("../prisma/prisma.service", () => ({
  PrismaService: class PrismaService {},
}));

import { PartnersService } from "./partners.service";

type ContactModelMock = {
  findFirst: jest.Mock;
  updateMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

type PartnerModelMock = {
  findUnique: jest.Mock;
};

type TransactionMock = {
  partnerOperationalContact: ContactModelMock;
};

function buildService(contactOverrides: Partial<ContactModelMock> = {}) {
  const tx: TransactionMock = {
    partnerOperationalContact: {
      findFirst: jest.fn().mockResolvedValue({ id: "contact-primary" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation((args: unknown) => Promise.resolve(args)),
      update: jest.fn().mockImplementation((args: unknown) => Promise.resolve(args)),
      ...contactOverrides,
    },
  };
  const partner: PartnerModelMock = {
    findUnique: jest.fn().mockResolvedValue({ id: "partner-1" }),
  };
  const prisma = {
    partner,
    $transaction: jest.fn((callback: (client: TransactionMock) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  return {
    service: new PartnersService(prisma as never),
    prisma,
    tx,
  };
}

describe("PartnersService", () => {
  it("clears the previous primary contact when creating a new primary contact", async () => {
    const { service, tx } = buildService();

    await service.createPartnerContact("partner-1", {
      name: "NOC",
      isPrimary: "on",
    });

    expect(tx.partnerOperationalContact.updateMany).toHaveBeenCalledWith({
      where: { partnerId: "partner-1", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(tx.partnerOperationalContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        partnerId: "partner-1",
        name: "NOC",
        isPrimary: true,
      }),
    });
  });

  it("clears other primary contacts when updating a contact as primary", async () => {
    const { service, tx } = buildService({
      findFirst: jest.fn().mockResolvedValue({ id: "contact-2" }),
    });

    await service.updatePartnerContact("partner-1", "contact-2", {
      role: "Suporte",
      isPrimary: "true",
    });

    expect(tx.partnerOperationalContact.updateMany).toHaveBeenCalledWith({
      where: { partnerId: "partner-1", id: { not: "contact-2" }, isPrimary: true },
      data: { isPrimary: false },
    });
    expect(tx.partnerOperationalContact.update).toHaveBeenCalledWith({
      where: { id: "contact-2" },
      data: expect.objectContaining({
        role: "Suporte",
        isPrimary: true,
      }),
    });
  });
});
