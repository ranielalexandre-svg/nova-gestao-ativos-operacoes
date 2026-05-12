jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { AttachmentsController } from './attachments.controller';

function buildController() {
  const service = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'attachment-new' }),
    remove: jest.fn().mockResolvedValue({ ok: true }),
    getDownload: jest.fn().mockResolvedValue({
      id: 'attachment-1',
      name: 'documento.pdf',
      mimeType: 'application/pdf',
      size: 123,
      stream: Buffer.from('pdf'),
    }),
  };

  const response = {
    setHeader: jest.fn(),
  };

  return {
    controller: new AttachmentsController(service as never),
    service,
    response,
  };
}

describe('AttachmentsController', () => {
  it('delegates list, create and remove requests to the service', async () => {
    const { controller, service } = buildController();
    const file = {
      originalname: 'documento.pdf',
      mimetype: 'application/pdf',
      size: 3,
      buffer: Buffer.from('pdf'),
    };

    await controller.list('units', 'unit-1');
    await controller.create('units', 'unit-1', file);
    await controller.remove('units', 'unit-1', 'attachment-1');

    expect(service.list).toHaveBeenCalledWith('units', 'unit-1');
    expect(service.create).toHaveBeenCalledWith('units', 'unit-1', file);
    expect(service.remove).toHaveBeenCalledWith('units', 'unit-1', 'attachment-1');
  });

  it('sets download headers and returns a streamable file', async () => {
    const { controller, service, response } = buildController();

    const result = await controller.download('attachment-1', response as never);

    expect(service.getDownload).toHaveBeenCalledWith('attachment-1');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', '123');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="documento.pdf"',
    );
    expect(result).toBeDefined();
  });
});
