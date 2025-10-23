import { db } from '../db';
import { serviceOrders } from '../db/schema';
import type { NewServiceOrder } from '../db/schema';
import { generateServiceOrderNumber } from '../utils/pdf';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 8) {
    console.log('Usage: bun run src/scripts/createServiceOrder.ts <clientId> <productType> <bookerName> <groupLeaderName> <totalPeople> <unitPriceUSD> <departureDate> <returnDate>');
    process.exit(1);
  }

  const clientIdArg = args[0]! as string;
  const productTypeArg = args[1]! as string;
  const bookerName = args[2]! as string;
  const groupLeaderName = args[3]! as string;
  const totalPeopleArg = args[4]! as string;
  const unitPriceUSDArg = args[5]! as string;
  const departureDateArg = args[6]! as string;
  const returnDateArg = args[7]! as string;

  const clientId = parseInt(clientIdArg);
  const totalPeople = parseInt(totalPeopleArg);
  const unitPriceUSD = parseFloat(unitPriceUSDArg);
  const departureDate = new Date(departureDateArg);
  const returnDate = new Date(returnDateArg);

  if ([clientId, totalPeople, unitPriceUSD].some((n) => isNaN(n))) {
    console.error('Numeric arguments invalid');
    process.exit(1);
  }

  const exchangeRateToSAR = 3.75;
  const totalPriceUSD = +(unitPriceUSD * totalPeople).toFixed(2);
  const totalPriceSAR = +(totalPriceUSD * exchangeRateToSAR).toFixed(2);

  const number = generateServiceOrderNumber();

  const payload: NewServiceOrder = {
    number,
    clientId,
    productType: productTypeArg as any,
    status: 'submitted' as any,
    bookerName,
    bookerEmail: null,
    bookerPhone: null,
    groupLeaderName,
    totalPeople,
    unitPriceUSD: String(unitPriceUSD) as any,
    totalPriceUSD: String(totalPriceUSD) as any,
    currency: 'USD',
    exchangeRateToSAR: String(exchangeRateToSAR) as any,
    totalPriceSAR: String(totalPriceSAR) as any,
    departureDate,
    returnDate,
    notes: null,
    meta: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [inserted] = await db.insert(serviceOrders).values(payload).returning();

  console.log(JSON.stringify(inserted, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});