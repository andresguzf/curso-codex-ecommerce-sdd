import { Injectable } from "@nestjs/common";

import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "./password";

const DUMMY_PASSWORD = "not-a-real-user-password-for-timing-equalization";

@Injectable()
export class PasswordService {
  private dummyHashPromise: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(password: string, encodedHash: string): Promise<boolean> {
    return verifyPassword(password, encodedHash);
  }

  needsRehash(encodedHash: string): boolean {
    return passwordNeedsRehash(encodedHash);
  }

  async verifyAgainstDummyHash(password: string): Promise<void> {
    this.dummyHashPromise ??= hashPassword(DUMMY_PASSWORD);
    await verifyPassword(password, await this.dummyHashPromise);
  }
}
