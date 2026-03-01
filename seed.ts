import Database from "better-sqlite3";

const db = new Database("inventory_v3.db");

const seedData = () => {
  console.log("Seeding database...");

  // Clear existing data
  db.exec("DELETE FROM inventory_in");
  db.exec("DELETE FROM inventory_out");
  db.exec("DELETE FROM stock_summary");

  const items = [
    { name: "Maize Flour", unit: "kg", price: 1200, threshold: 50 },
    { name: "Beans", unit: "kg", price: 2500, threshold: 30 },
    { name: "Cooking Oil", unit: "liters", price: 3500, threshold: 10 },
    { name: "Rice", unit: "kg", price: 1800, threshold: 40 },
    { name: "Salt", unit: "kg", price: 800, threshold: 5 },
    { name: "Sugar", unit: "kg", price: 1500, threshold: 10 },
    { name: "Cement", unit: "Bags", price: 15000, threshold: 5 },
    { name: "Garlic", unit: "kg", price: 4000, threshold: 2 },
    { name: "Onions", unit: "kg", price: 1200, threshold: 10 }
  ];

  const responsible = "ubuntu.francoisb@fraternidadesemfronteiras.org.br";
  const authBy = "yohanechafunyala@gmail.com";

  // Insert Stock Summary and Initial IN transactions
  const insertIn = db.prepare(`
    INSERT INTO inventory_in (item_name, mode_of_need, qnty_type, qty_units, qty_bucks, unit_price, total_price, date_in, supplier, responsible_email, signed_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStock = db.prepare(`
    INSERT INTO stock_summary (item_name, total_in_units, current_stock, last_updated, low_stock_threshold)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(item_name) DO UPDATE SET
      total_in_units = total_in_units + EXCLUDED.total_in_units,
      current_stock = current_stock + EXCLUDED.current_stock,
      last_updated = CURRENT_TIMESTAMP
  `);

  const months = ["2026-01", "2026-02"];
  
  items.forEach(item => {
    const qty = Math.floor(Math.random() * 200) + 100;
    const totalBucks = qty * item.price;
    
    // Initial stock in January
    insertIn.run(
      item.name, 
      "Monthly Purchase", 
      item.unit, 
      qty, 
      totalBucks, 
      item.price, 
      totalBucks, 
      "2026-01-05", 
      "Bought Outside", 
      responsible, 
      authBy, 
      "Initial stock for the year"
    );
    updateStock.run(item.name, qty, qty, item.threshold);

    // Some additions in February
    const addQty = Math.floor(Math.random() * 50);
    const addBucks = addQty * item.price;
    insertIn.run(
      item.name, 
      "Weekly Purchase", 
      item.unit, 
      addQty, 
      addBucks, 
      item.price, 
      addBucks, 
      "2026-02-10", 
      "Bought Outside", 
      responsible, 
      authBy, 
      "Weekly top-up"
    );
    updateStock.run(item.name, addQty, addQty, item.threshold);
  });

  // Insert OUT transactions
  const insertOut = db.prepare(`
    INSERT INTO inventory_out (item_name, location_to, garden, unit_type, item_type, qty_units, qty_bucks, date_out, auth_status, auth_by, responsible_email, comment, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const deductStock = db.prepare(`
    UPDATE stock_summary SET
      total_out_units = total_out_units + ?,
      current_stock = current_stock - ?,
      last_updated = CURRENT_TIMESTAMP
    WHERE item_name = ?
  `);

  const locations = ["School", "Project", "RCC Kitchen"];
  
  items.forEach(item => {
    // 5-10 transactions per item
    const numTrans = Math.floor(Math.random() * 5) + 5;
    for(let i = 0; i < numTrans; i++) {
      const qtyOut = Math.floor(Math.random() * 10) + 1;
      const date = `2026-02-${Math.floor(Math.random() * 25) + 1}`.replace("-2-", "-02-").replace("-2026-02-", "2026-02-").padStart(10, '0');
      // Fix date padding
      const day = (Math.floor(Math.random() * 25) + 1).toString().padStart(2, '0');
      const finalDate = `2026-02-${day}`;

      insertOut.run(
        item.name,
        locations[Math.floor(Math.random() * locations.length)],
        "",
        item.unit,
        "Standard",
        qtyOut,
        qtyOut * item.price,
        finalDate,
        "Approved",
        authBy,
        responsible,
        "Daily consumption",
        "Kitchen use"
      );
      deductStock.run(qtyOut, qtyOut, item.name);
    }
  });

  console.log("Seeding completed successfully.");
};

seedData();
