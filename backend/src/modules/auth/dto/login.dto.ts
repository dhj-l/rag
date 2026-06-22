import { IsString, MinLength } from 'class-validator';

/** 登录 DTO（§3.6 POST /api/auth/login） */
export class LoginDto {
  /** 登录用户名（与 users 集合 username 唯一索引匹配） */
  @IsString()
  username!: string;

  /** 明文密码，后端用 bcrypt.compare 与哈希校验（≥1 位，非空） */
  @IsString()
  @MinLength(1, { message: '密码不能为空' })
  password!: string;
}
