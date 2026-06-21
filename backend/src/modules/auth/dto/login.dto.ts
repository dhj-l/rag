import { IsString, MinLength } from 'class-validator';

/** 登录 DTO（§3.6 POST /api/auth/login） */
export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(1, { message: '密码不能为空' })
  password!: string;
}
