import { Test, type TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * The controller is a thin delegator, so these assert the delegation rather
 * than re-testing the service. Previously it registered AuthController with no
 * providers, so AuthService could not be injected and DI failed.
 */
describe('AuthController', () => {
  let controller: AuthController;
  let auth: { register: jest.Mock; verifyEmail: jest.Mock; login: jest.Mock };

  beforeEach(async () => {
    auth = {
      register: jest.fn().mockResolvedValue({ success: true }),
      verifyEmail: jest.fn().mockResolvedValue({ accessToken: 't' }),
      login: jest.fn().mockResolvedValue({ accessToken: 't' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('passes registration through to the service', async () => {
    await controller.register({ email: 'a@example.com', password: 'secret123' });
    expect(auth.register).toHaveBeenCalledWith('a@example.com', 'secret123');
  });

  it('passes the email and OTP through on verification', async () => {
    await controller.verifyEmail({ email: 'a@example.com', otp: '123456' });
    expect(auth.verifyEmail).toHaveBeenCalledWith('a@example.com', '123456');
  });

  it('passes credentials through on login', async () => {
    await controller.login({ email: 'a@example.com', password: 'secret123' });
    expect(auth.login).toHaveBeenCalledWith('a@example.com', 'secret123');
  });
});
