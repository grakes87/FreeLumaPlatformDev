import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

const FILLER_SCRIPT_ES = `Bienvenidos al momento de positividad de hoy. Toma un respiro profundo y deja ir cualquier tension que estes cargando. Recuerda que cada dia es una nueva oportunidad para crecer, aprender y compartir bondad. Eres mas fuerte de lo que crees, y tu presencia en este mundo importa mas de lo que imaginas. Hoy, elige ver la belleza en las pequenas cosas—una taza de cafe caliente, una sonrisa de un extrano, la forma en que la luz del sol baila entre los arboles. Estos momentos de gratitud pueden transformar toda tu perspectiva. Asi que sal y se la luz que alguien necesita hoy. Tu puedes!`;

const [result] = await conn.query(
  `UPDATE daily_content
   SET camera_script = ?
   WHERE mode = 'positivity'
     AND language = 'es'
     AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
     AND (camera_script IS NULL OR camera_script = '')`,
  [FILLER_SCRIPT_ES]
);

console.log(`Updated: ${result.changedRows} Spanish positivity rows with filler camera_script`);

// Verify
const [verify] = await conn.query(`
  SELECT SUM(camera_script IS NULL OR camera_script = '') as missing
  FROM daily_content
  WHERE mode = 'positivity' AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
`);
console.log(`Remaining missing camera_script: ${verify[0].missing}`);

await conn.end();
