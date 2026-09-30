import { Injectable } from "@nestjs/common";
import { and, count, eq, isNull } from "drizzle-orm";
import type { DatabaseTransaction } from "../database/database.service";
import { roleAssignments, users } from "../database/schema";

@Injectable()
export class IdentitySummaryReader {
  async countCustomers(transaction: DatabaseTransaction): Promise<number> {
    const [result] = await transaction.select({ total: count() }).from(users)
      .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
      .where(and(eq(roleAssignments.role, "CUSTOMER"), isNull(users.deletedAt)));
    return result?.total ?? 0;
  }
}
