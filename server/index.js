require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const port = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET not set. Using fallback secret for development only.");
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

connectDB();
