import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
async function seed(){
  // Settings marks completed initialization. Re-seeding must not undo user edits.
  if (await db.settings.findUnique({where:{id:'default'}})) return;
  for(const [name,type] of [['BRI','bank'],['Jago','bank'],['SeaBank','bank'],['Cash','cash']]) await db.account.upsert({where:{name},create:{name,type,initialBalance:0},update:{}});
  for(const [type,names] of Object.entries({expense:['Makan','Minuman','Transportasi','Belanja','Tagihan','Hiburan','Pendidikan','Kesehatan','Investasi','Hadiah','Perjalanan','Lainnya'],income:['Gaji','Project','Bonus','Penjualan','Investasi','Refund','Lainnya']})) for(const name of names) await db.category.upsert({where:{name_type:{name,type}},create:{name,type,icon:type==='income'?'trending-up':'tag'},update:{}});
  const account=await db.account.findUniqueOrThrow({where:{name:'BRI'}});
  await db.settings.upsert({where:{id:'default'},create:{id:'default',defaultAccountId:account.id},update:{}});
}
seed().catch(()=>{console.error('Database seed failed');process.exitCode=1;}).finally(()=>db.$disconnect());
