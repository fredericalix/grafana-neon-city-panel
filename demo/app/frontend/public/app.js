const euro = (cents) => `¥${(cents / 100).toFixed(2)}`;

async function loadMenu() {
  const res = await fetch('/api/menu');
  const { menu, instance } = await res.json();
  document.getElementById('served-by').textContent = `api served by ${instance}`;
  const ul = document.getElementById('menu');
  ul.innerHTML = '';
  for (const item of menu) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = item.name;
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = euro(item.price_cents);
    const btn = document.createElement('button');
    btn.textContent = 'ORDER';
    btn.addEventListener('click', () => order(item.id, btn));
    li.append(name, price, btn);
    ul.append(li);
  }
}

async function order(itemId, btn) {
  btn.disabled = true;
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('served-by').textContent = `order #${data.order.id} taken by ${data.instance}`;
    }
    await loadOrders(true);
  } finally {
    btn.disabled = false;
  }
}

async function loadOrders(fresh = false) {
  const res = await fetch('/api/orders?limit=12');
  if (!res.ok) {
    return;
  }
  const { orders } = await res.json();
  const ul = document.getElementById('orders');
  ul.innerHTML = '';
  orders.forEach((o, i) => {
    const li = document.createElement('li');
    if (fresh && i === 0) {
      li.className = 'fresh';
    }
    const name = document.createElement('span');
    name.textContent = `${o.quantity}× ${o.name}`;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = o.served_by;
    li.append(name, who);
    ul.append(li);
  });
}

loadMenu().catch(() => {
  document.getElementById('served-by').textContent = 'api unreachable';
});
loadOrders().catch(() => {});
setInterval(() => loadOrders().catch(() => {}), 3000);
