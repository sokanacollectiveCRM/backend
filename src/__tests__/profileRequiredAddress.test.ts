import { DoulaController } from '../features/doulas/http/doulaController';
describe('required address values on local profile saves', () => {
  it.each(['address', 'city', 'state', 'zip_code'].flatMap((field) => ['', '   ', null].map((value) => [field, value])))(
    'rejects %s = %p before writing', async (field, value) => {
      const controller = Object.create(DoulaController.prototype) as any;
      controller.cloudSqlTeamService = { updateTeamMember: jest.fn() };
      const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await controller.updateMyProfile({ user: { id: 'fictional' }, body: { phone_number: '2025550100', [field as string]: value } }, response);
      expect(response.status).toHaveBeenCalledWith(400);
      expect(controller.cloudSqlTeamService.updateTeamMember).not.toHaveBeenCalled();
    }
  );
});
