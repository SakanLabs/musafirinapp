import { verify } from 'hono/jwt';
console.log("Checking JWT...");
console.time("jwt");
try {
  await verify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid", "asecret");
} catch(e) {}
console.timeEnd("jwt");
