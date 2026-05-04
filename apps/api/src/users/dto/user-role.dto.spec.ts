import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { ListUsersQueryDto } from './list-users-query.dto';
import { UpdateUserDto } from './update-user.dto';

describe('user role DTOs', () => {
  it('accept editor as a managed user role', async () => {
    const createDto = Object.assign(new CreateUserDto(), {
      email: 'editor@nova.local',
      name: 'Editor NOVA',
      role: 'editor',
      password: 'Nova123456',
    });
    const updateDto = Object.assign(new UpdateUserDto(), {
      role: 'editor',
    });
    const listDto = Object.assign(new ListUsersQueryDto(), {
      role: 'editor',
    });

    await expect(validate(createDto)).resolves.toHaveLength(0);
    await expect(validate(updateDto)).resolves.toHaveLength(0);
    await expect(validate(listDto)).resolves.toHaveLength(0);
  });
});
