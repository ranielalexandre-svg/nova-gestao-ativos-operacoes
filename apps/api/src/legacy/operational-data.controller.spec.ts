jest.mock("../prisma/prisma.service", () => ({
  PrismaService: class PrismaService {},
}));

import { OperationalDataController } from "./operational-data.controller";

function buildController() {
  const legacyService = {
    getSummary: jest.fn(),
    getReconciliation: jest.fn(),
    getUnitOperationalData: jest.fn(),
    updateUnitOperationalData: jest.fn(),
    importUnitOperationalData: jest.fn(),
  };

  return {
    controller: new OperationalDataController(legacyService as never),
    legacyService,
  };
}

describe("OperationalDataController", () => {
  it("reads operational import summary through the operational route", () => {
    const { controller, legacyService } = buildController();

    controller.getOperationalSummary();

    expect(legacyService.getSummary).toHaveBeenCalledTimes(1);
  });

  it("reads operational reconciliation through the operational route", () => {
    const { controller, legacyService } = buildController();

    controller.getOperationalReconciliation();

    expect(legacyService.getReconciliation).toHaveBeenCalledTimes(1);
  });

  it("reads unit operational data through the operational route", () => {
    const { controller, legacyService } = buildController();

    controller.getUnitOperationalData("unit-1");

    expect(legacyService.getUnitOperationalData).toHaveBeenCalledWith("unit-1", false);
  });

  it("passes actor id when revealing sensitive operational data", () => {
    const { controller, legacyService } = buildController();

    controller.revealUnitOperationalData("unit-1", { user: { id: "user-1" } });

    expect(legacyService.getUnitOperationalData).toHaveBeenCalledWith("unit-1", true, "user-1");
  });

  it("updates unit operational data through the operational route", () => {
    const { controller, legacyService } = buildController();
    const payload = { phone: "masked test payload" };

    controller.updateUnitOperationalData("unit-1", "info-1", payload, { user: { id: "user-1" } });

    expect(legacyService.updateUnitOperationalData).toHaveBeenCalledWith(
      "unit-1",
      "info-1",
      payload,
      "user-1",
    );
  });

  it("imports unit operational data through the operational route", () => {
    const { controller, legacyService } = buildController();

    controller.importUnitOperationalData({ user: { id: "user-1" } });

    expect(legacyService.importUnitOperationalData).toHaveBeenCalledWith("user-1");
  });
});
