const fs = require('fs');
const file = 'server/src/routes/muthowifBookings.ts';
let code = fs.readFileSync(file, 'utf8');

// Fix Object is possibly undefined by using [0]! or assigning to variable
code = code.replace(/booking\[0\]/g, 'booking[0]!');
code = code.replace(/invoice\[0\]/g, 'invoice[0]!');

// Fix partial -> partially_paid
code = code.replace(/'partial'/g, "'partially_paid'");

fs.writeFileSync(file, code);
