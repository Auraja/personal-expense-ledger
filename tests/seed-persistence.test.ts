import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
const db = new PrismaClient();
test('restarts preserve renamed and deleted default resources', async () => {
  try {
    execFileSync('node_modules/.bin/tsx', ['prisma/seed.ts']);
    await db.account.update({where:{name:'BRI'},data:{name:'BRI Personal'}});
    await db.account.delete({where:{name:'blu by BCA'}});
    await db.category.delete({where:{name_type:{name:'Minuman',type:'expense'}}});
    execFileSync('node_modules/.bin/tsx', ['prisma/seed.ts']);
    assert.equal(await db.account.count(), 3, 'seed must not recreate renamed/deleted accounts');
    assert.equal(await db.category.count(), 18, 'seed must not recreate deleted category');
    assert.equal(await db.account.count({where:{name:'BRI Personal'}}),1);
  } finally { await db.$disconnect(); }
});
