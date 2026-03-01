import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("inventory_v5.db");

// Initialize Database
console.log("Initializing database...");
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_in (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_name TEXT NOT NULL,
      mode_of_need TEXT,
      qnty_type TEXT,
      qnty_per_raw REAL, -- Qnty Per kg/L/Bn
      total_qnty REAL NOT NULL, -- Total Qnty (Units)
      unit_price REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      stock_level REAL,
      fixed_value_remain REAL,
      responsible TEXT NOT NULL,
      signed_by TEXT,
      date_in TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_out (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      location_type TEXT NOT NULL,
      garden TEXT,
      unit_type TEXT,
      item_type TEXT,
      qnty_taken_raw REAL,
      total_qnty_taken REAL NOT NULL,
      qnty_added_in_raw REAL,
      qnty_added_in_bucks REAL,
      bo_price_per_unit REAL,
      total_price REAL,
      check_stock REAL,
      auth_status TEXT DEFAULT 'Approved',
      date_out TEXT NOT NULL,
      auth_by TEXT,
      comment TEXT,
      notes TEXT,
      responsible_email TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_summary (
      item_name TEXT PRIMARY KEY,
      total_in_units REAL DEFAULT 0,
      total_out_units REAL DEFAULT 0,
      current_stock REAL DEFAULT 0,
      fixed_value_remain REAL DEFAULT 5,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Database initialized successfully.");

  // Migration: Ensure department column exists in inventory_out
  try {
    const tableInfo = db.prepare("PRAGMA table_info(inventory_out)").all() as any[];
    const hasDepartment = tableInfo.some(col => col.name === 'department');
    if (!hasDepartment) {
      console.log("Adding department column to inventory_out...");
      db.prepare("ALTER TABLE inventory_out ADD COLUMN department TEXT").run();
    }
  } catch (err) {
    console.error("Migration error:", err);
  }

  // Seed Initial Data if empty
  const count = db.prepare("SELECT COUNT(*) as count FROM stock_summary").get() as any;
  if (count.count === 0) {
    console.log("Seeding initial data from Ubuntu School Kitchen sheet...");
    
    const formatDate = (d: string) => {
      if (!d) return "2026-01-14";
      const parts = d.split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      return d;
    };

    const seedIn = db.prepare(`
      INSERT INTO inventory_in (material_name, mode_of_need, qnty_type, qnty_per_raw, total_qnty, unit_price, total_amount, stock_level, fixed_value_remain, responsible, signed_by, date_in, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const seedOut = db.prepare(`
      INSERT INTO inventory_out (item_name, location_type, department, garden, unit_type, item_type, qnty_taken_raw, total_qnty_taken, qnty_added_in_raw, qnty_added_in_bucks, bo_price_per_unit, total_price, check_stock, date_out, auth_by, comment, notes, responsible_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const seedStock = db.prepare(`
      INSERT INTO stock_summary (item_name, total_in_units, total_out_units, current_stock, fixed_value_remain)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(item_name) DO UPDATE SET
        total_in_units = total_in_units + excluded.total_in_units,
        total_out_units = total_out_units + excluded.total_out_units,
        current_stock = current_stock + excluded.total_in_units - excluded.total_out_units
    `);

    const transaction = db.transaction(() => {
      // Maize
      seedIn.run("Maize", "Monthly Purchase", "kg", 8450, 169, 0, 0, 169, 30, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("Maize", 150, 0, 150, 30); // Initial 150 units from Row 1
      seedOut.run("Maize", "Project Store", "Kitchen", "", "kg", "", 1800, 36, 0, 0, 0, 0, 114, "2026-01-14", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Maize", 0, 36, 0, 30);
      seedOut.run("Maize", "Project Store", "Kitchen", "", "kg", "", 1050, 21, 0, 0, 0, 0, 93, "2026-01-16", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Maize", 0, 21, 0, 30);

      // Cooking Oil
      seedIn.run("Cooking Oil", "Monthly Purchase", "liters", 420, 21, 0, 0, 21, 4, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("Cooking Oil", 17, 0, 17, 4); // Row 2
      seedOut.run("Cooking Oil", "Project Store", "Kitchen", "", "liters", "", 60, 3, 0, 0, 0, 0, 14, "2026-01-16", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Cooking Oil", 0, 3, 0, 4);

      // Sugar
      seedIn.run("Sugar", "Monthly Purchase", "kg", 660, 34, 0, 0, 34, 7, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("Sugar", 32, 0, 32, 7); // Row 3
      seedOut.run("Sugar", "Project Store", "Kitchen", "", "kg", "", 125, 6, 0, 0, 0, 0, 26, "2026-01-16", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Sugar", 0, 6, 0, 7);

      // Soya Beans
      seedIn.run("Soya Beans", "Monthly Purchase", "kg", 200, 4, 0, 0, 4, 1, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("Soya Beans", 4, 0, 4, 1);
      seedOut.run("Soya Beans", "Project Store", "Kitchen", "", "kg", "", 50, 1, 0, 0, 0, 0, 3, "2026-01-16", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Soya Beans", 0, 1, 0, 1);

      // Tomato (Daily Purchase)
      seedIn.run("Tomato", "Weekly Purchase", "Basin", 0, 0, 0, 155000, 0, 3, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("Tomato", 10, 0, 10, 3);
      seedOut.run("Tomato", "Bought Outside", "Kitchen", "", "Basin", "", 1, 1, 0, 0, 0, 0, 9, "2026-01-14", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Tomato", 0, 1, 0, 3);

      // Onion
      seedIn.run("Onion", "Weekly Purchase", "kg", 0, 0, 0, 120000, 0, 2, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("Onion", 15, 0, 15, 2);
      seedOut.run("Onion", "Bought Outside", "Kitchen", "", "kg", "", 2, 2, 0, 0, 0, 0, 13, "2026-01-14", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Onion", 0, 2, 0, 2);

      // Eggs
      seedIn.run("Eggs", "Weekly Purchase", "Tray", 0, 0, 0, 120000, 0, 5, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("Eggs", 20, 0, 20, 5);
      seedOut.run("Eggs", "Bought Outside", "Kitchen", "", "Tray", "", 3, 3, 0, 0, 0, 0, 17, "2026-01-14", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Eggs", 0, 3, 0, 5);

      // Soya Pieces
      seedIn.run("Soya Pieces", "Monthly Purchase", "Bales", 79, 79, 0, 0, 79, 12, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("Soya Pieces", 60, 0, 60, 12); // Row 5
      seedOut.run("Soya Pieces", "Project Store", "Kitchen", "", "Bales", "", 12, 12, 0, 0, 0, 0, 48, "2026-01-16", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Soya Pieces", 0, 12, 0, 12);

      // salt
      seedIn.run("salt", "Monthly Purchase", "kg", 139, 7, 0, 0, 7, 2, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-14", "");
      seedStock.run("salt", 10, 0, 10, 2); // Row 4
      seedOut.run("salt", "Project Store", "Kitchen", "", "kg", "", 20, 1, 0, 0, 0, 0, 9, "2026-01-16", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("salt", 0, 1, 0, 2);

      // Cabbage (Daily Purchase)
      seedIn.run("Cabbage", "Daily Purchase", "Piece", 205, 205, 0, 685000, 205, 200, "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "2026-01-19", "");
      seedStock.run("Cabbage", 50, 0, 50, 200); // Row 21
      seedOut.run("Cabbage", "Project Store", "Kitchen", "", "Piece", "", 50, 50, 0, 0, 0, 0, 0, "2026-01-19", "ubuntu.francoisb@fraternidadesemfronteiras.org.br", "", "", "ubuntu.francoisb@fraternidadesemfronteiras.org.br");
      seedStock.run("Cabbage", 0, 50, 0, 200);
    });

    try {
      transaction();
      console.log("Seeding complete.");
    } catch (err) {
      console.error("Seeding error:", err);
    }
  }
} catch (error) {
  console.error("CRITICAL: Database initialization failed:", error);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });
  
  // 1. Get Stock Summary
  app.get("/api/stock", (req, res) => {
    try {
      console.log("GET /api/stock");
      const stocks = db.prepare("SELECT * FROM stock_summary ORDER BY item_name ASC").all();
      res.json(stocks);
    } catch (error) {
      console.error("Error in /api/stock:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. Record Material IN
  app.post("/api/inventory/in", (req, res) => {
    const { 
      material_name, mode_of_need, qnty_type, qnty_per_raw, total_qnty, 
      unit_price, total_amount, fixed_value_remain, responsible, signed_by, date_in, notes 
    } = req.body;

    const insertIn = db.prepare(`
      INSERT INTO inventory_in (material_name, mode_of_need, qnty_type, qnty_per_raw, total_qnty, unit_price, total_amount, stock_level, fixed_value_remain, responsible, signed_by, date_in, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      INSERT INTO stock_summary (item_name, total_in_units, current_stock, fixed_value_remain, last_updated)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(item_name) DO UPDATE SET
        total_in_units = total_in_units + excluded.total_in_units,
        current_stock = current_stock + excluded.total_in_units,
        fixed_value_remain = excluded.fixed_value_remain,
        last_updated = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction(() => {
      insertIn.run(material_name, mode_of_need, qnty_type, qnty_per_raw, total_qnty, unit_price, total_amount, total_qnty, fixed_value_remain, responsible, signed_by, date_in, notes);
      updateStock.run(material_name, total_qnty, total_qnty, fixed_value_remain);
    });

    try {
      transaction();
      res.json({ success: true, message: "Material recorded! Stock updated ✅" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 3. Record Material OUT
  app.post("/api/inventory/out", (req, res) => {
    const { 
      item_name, location_type, department, garden, unit_type, item_type, 
      qnty_taken_raw, total_qnty_taken, qnty_added_in_raw, qnty_added_in_bucks, 
      bo_price_per_unit, total_price, date_out, auth_by, responsible_email, comment, notes 
    } = req.body;

    // Check availability
    const stock = db.prepare("SELECT current_stock FROM stock_summary WHERE item_name = ?").get() as any;
    if (!stock || stock.current_stock < total_qnty_taken) {
      return res.status(400).json({ success: false, message: "Insufficient stock available!" });
    }

    const check_stock = stock.current_stock - total_qnty_taken;

    const insertOut = db.prepare(`
      INSERT INTO inventory_out (item_name, location_type, department, garden, unit_type, item_type, qnty_taken_raw, total_qnty_taken, qnty_added_in_raw, qnty_added_in_bucks, bo_price_per_unit, total_price, check_stock, date_out, auth_by, comment, notes, responsible_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      UPDATE stock_summary SET
        total_out_units = total_out_units + ?,
        current_stock = current_stock - ?,
        last_updated = CURRENT_TIMESTAMP
      WHERE item_name = ?
    `);

    const transaction = db.transaction(() => {
      insertOut.run(item_name, location_type, department || "", garden || "", unit_type || "", item_type || "", qnty_taken_raw || 0, total_qnty_taken, qnty_added_in_raw || 0, qnty_added_in_bucks || 0, bo_price_per_unit || 0, total_price || 0, check_stock, date_out, auth_by || "", comment || "", notes || "", responsible_email);
      updateStock.run(total_qnty_taken, total_qnty_taken, item_name);
    });

    try {
      transaction();
      res.json({ success: true, message: "Stock-out recorded! ✅" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 4. Get Transactions with Filtering
  app.get("/api/transactions", (req, res) => {
    try {
      const { search, startDate, endDate } = req.query;
      
      let queryIn = `SELECT 'IN' as type, id, material_name as item_name, total_qnty as qty_units, total_amount as qty_bucks, date_in as date, responsible as responsible_email, notes, mode_of_need as department FROM inventory_in WHERE 1=1`;
      let queryOut = `SELECT 'OUT' as type, id, item_name, total_qnty_taken as qty_units, total_price as qty_bucks, date_out as date, responsible_email, notes, department FROM inventory_out WHERE 1=1`;
      
      const paramsIn: any[] = [];
      const paramsOut: any[] = [];

      if (search) {
        queryIn += ` AND (material_name LIKE ? OR notes LIKE ?)`;
        queryOut += ` AND (item_name LIKE ? OR notes LIKE ?)`;
        const s = `%${search}%`;
        paramsIn.push(s, s);
        paramsOut.push(s, s);
      }

      if (startDate) {
        queryIn += ` AND date_in >= ?`;
        queryOut += ` AND date_out >= ?`;
        paramsIn.push(startDate);
        paramsOut.push(startDate);
      }

      if (endDate) {
        queryIn += ` AND date_in <= ?`;
        queryOut += ` AND date_out <= ?`;
        paramsIn.push(endDate);
        paramsOut.push(endDate);
      }

      const transactionsIn = db.prepare(queryIn).all(...paramsIn);
      const transactionsOut = db.prepare(queryOut).all(...paramsOut);

      const all = [...transactionsIn, ...transactionsOut].sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      res.json(all);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 5. Dashboard Stats
  app.get("/api/dashboard/stats", (req, res) => {
    try {
      const totalIn = db.prepare("SELECT SUM(total_amount) as total FROM inventory_in").get() as any;
      const totalOut = db.prepare("SELECT SUM(total_price) as total FROM inventory_out").get() as any;
      const stockItems = db.prepare("SELECT COUNT(*) as count FROM stock_summary WHERE current_stock > 0").get() as any;
      const lowStock = db.prepare("SELECT COUNT(*) as count FROM stock_summary WHERE current_stock <= fixed_value_remain AND current_stock > 0").get() as any;

      res.json({
        total_in_value: totalIn.total || 0,
        total_out_value: totalOut.total || 0,
        active_items: stockItems.count || 0,
        low_stock_alerts: lowStock.count || 0
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 6. Chart Data
  app.get("/api/dashboard/charts", (req, res) => {
    try {
      const { granularity = 'monthly' } = req.query;
      
      let dateFormat = '%Y-%m';
      if (granularity === 'weekly') dateFormat = '%Y-W%W';
      else if (granularity === 'yearly') dateFormat = '%Y';

      const movement = db.prepare(`
        SELECT period, SUM(units_in) as units_in, SUM(units_out) as units_out FROM (
          SELECT strftime('${dateFormat}', date_in) as period, SUM(total_qnty) as units_in, 0 as units_out FROM inventory_in GROUP BY period
          UNION ALL
          SELECT strftime('${dateFormat}', date_out) as period, 0 as units_in, SUM(total_qnty_taken) as units_out FROM inventory_out GROUP BY period
        ) GROUP BY period ORDER BY period ASC
      `).all();

      const itemDistribution = db.prepare(`
        SELECT item_name as name, current_stock as value FROM stock_summary WHERE current_stock > 0 ORDER BY current_stock DESC LIMIT 5
      `).all();

      res.json({ movement, itemDistribution });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 6. AI Context Data
  app.get("/api/ai/context", (req, res) => {
    try {
      const stocks = db.prepare("SELECT * FROM stock_summary").all();
      const recentTransactions = db.prepare(`
        SELECT 'IN' as type, material_name as item_name, total_qnty as qty_units, total_amount as qty_bucks, date_in as date, notes FROM inventory_in
        UNION ALL
        SELECT 'OUT' as type, item_name, total_qnty_taken as qty_units, total_price as qty_bucks, date_out as date, notes FROM inventory_out
        ORDER BY date DESC LIMIT 50
      `).all();
      
      const monthlyTrends = db.prepare(`
        SELECT month, SUM(units_in) as units_in, SUM(units_out) as units_out, SUM(bucks_in) as bucks_in FROM (
          SELECT strftime('%Y-%m', date_in) as month, SUM(total_qnty) as units_in, 0 as units_out, SUM(total_amount) as bucks_in FROM inventory_in GROUP BY month
          UNION ALL
          SELECT strftime('%Y-%m', date_out) as month, 0 as units_in, SUM(total_qnty_taken) as units_out, 0 as bucks_in FROM inventory_out GROUP BY month
        ) GROUP BY month ORDER BY month DESC LIMIT 12
      `).all();

      res.json({
        stocks,
        recentTransactions,
        monthlyTrends,
        currentTime: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error in /api/ai/context:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
