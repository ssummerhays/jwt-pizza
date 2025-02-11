import exp from "constants";
import { test, expect } from "playwright-test-coverage";

test("home page", async ({ page }) => {
  await page.goto("/");

  expect(await page.title()).toBe("JWT Pizza");
});

test("purchase with login", async ({ page }) => {
  await page.route("*/**/api/order/menu", async (route) => {
    const menuRes = [
      {
        id: 1,
        title: "Veggie",
        image: "pizza1.png",
        price: 0.0038,
        description: "A garden of delight",
      },
      {
        id: 2,
        title: "Pepperoni",
        image: "pizza2.png",
        price: 0.0042,
        description: "Spicy treat",
      },
    ];
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: menuRes });
  });

  await page.route("*/**/api/franchise", async (route) => {
    const franchiseRes = [
      {
        id: 2,
        name: "LotaPizza",
        stores: [
          { id: 4, name: "Lehi" },
          { id: 5, name: "Springville" },
          { id: 6, name: "American Fork" },
        ],
      },
      { id: 3, name: "PizzaCorp", stores: [{ id: 7, name: "Spanish Fork" }] },
      { id: 4, name: "topSpot", stores: [] },
    ];
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: franchiseRes });
  });

  await page.route("*/**/api/auth", async (route) => {
    const loginReq = { email: "d@jwt.com", password: "a" };
    const loginRes = {
      user: {
        id: 3,
        name: "Kai Chen",
        email: "d@jwt.com",
        roles: [{ role: "diner" }],
      },
      token: "abcdef",
    };
    expect(route.request().method()).toBe("PUT");
    expect(route.request().postDataJSON()).toMatchObject(loginReq);
    await route.fulfill({ json: loginRes });
  });

  await page.route("*/**/api/order", async (route) => {
    const orderReq = {
      items: [
        { menuId: 1, description: "Veggie", price: 0.0038 },
        { menuId: 2, description: "Pepperoni", price: 0.0042 },
      ],
      storeId: "4",
      franchiseId: 2,
    };
    const orderRes = {
      order: {
        items: [
          { menuId: 1, description: "Veggie", price: 0.0038 },
          { menuId: 2, description: "Pepperoni", price: 0.0042 },
        ],
        storeId: "4",
        franchiseId: 2,
        id: 23,
      },
      jwt: "eyJpYXQ",
    };
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject(orderReq);
    await route.fulfill({ json: orderRes });
  });

  await page.goto("/");

  // Go to order page
  await page.getByRole("button", { name: "Order now" }).click();

  // Create order
  await expect(page.locator("h2")).toContainText("Awesome is a click away");
  await page.getByRole("combobox").selectOption("4");
  await page.getByRole("link", { name: "Image Description Veggie A" }).click();
  await page.getByRole("link", { name: "Image Description Pepperoni" }).click();
  await expect(page.locator("form")).toContainText("Selected pizzas: 2");
  await page.getByRole("button", { name: "Checkout" }).click();

  // Login
  await page.getByPlaceholder("Email address").click();
  await page.getByPlaceholder("Email address").fill("d@jwt.com");
  await page.getByPlaceholder("Email address").press("Tab");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  // Pay
  await expect(page.getByRole("main")).toContainText(
    "Send me those 2 pizzas right now!"
  );
  await expect(page.locator("tbody")).toContainText("Veggie");
  await expect(page.locator("tbody")).toContainText("Pepperoni");
  await expect(page.locator("tfoot")).toContainText("0.008 ₿");
  await page.getByRole("button", { name: "Pay now" }).click();

  // Check balance
  await expect(page.getByText("0.008")).toBeVisible();
});

test("create and delete store as franchisee", async ({ page }) => {
  await page.route("*/**/api/auth", async (route) => {
    const loginReq = { email: "f@jwt.com", password: "franchisee" };
    const loginRes = {
      user: {
        id: 3,
        name: "pizza franchisee",
        email: "f@jwt.com",
        roles: [{ objectId: 1, role: "franchisee" }],
      },
      token: "abcdef",
    };
    expect(route.request().method()).toBe("PUT");
    expect(route.request().postDataJSON()).toMatchObject(loginReq);
    await route.fulfill({ json: loginRes });
  });

  let initialState = true;
  await page.route("*/**/api/franchise/*", async (route) => {
    const franchiseRes = initialState
      ? [
          {
            id: 1,
            name: "pizzaPocket",
            admins: [
              {
                id: 3,
                name: "pizza franchisee",
                email: "f@jwt.com",
              },
            ],
            stores: [
              {
                id: 1,
                name: "SLC",
                totalRevenue: 0.4996,
              },
            ],
          },
        ]
      : [
          {
            id: 1,
            name: "pizzaPocket",
            admins: [
              {
                id: 3,
                name: "pizza franchisee",
                email: "f@jwt.com",
              },
            ],
            stores: [
              {
                id: 1,
                name: "SLC",
                totalRevenue: 0.4996,
              },
              {
                id: 2,
                name: "testStore",
                totalRevenue: 0.0,
              },
            ],
          },
        ];
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: franchiseRes });
    initialState = false;
  });

  await page.route("*/**/api/franchise/*/store", async (route) => {
    const createStoreReq = {
      id: "",
      name: "testStore",
    };
    const createStoreRes = {
      id: 35,
      franchiseId: 1,
      name: "testStore",
    };
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject(createStoreReq);
    await route.fulfill({ json: createStoreRes });
  });

  await page.route("*/**/api/franchise/*/store/*", async (route) => {
    const deleteStoreRes = {
      message: "store deleted",
    };
    expect(route.request().method()).toBe("DELETE");
    await route.fulfill({ json: deleteStoreRes });
  });

  await page.goto("http://localhost:5173/");

  // Login
  await page.getByRole("link", { name: "Login" }).click();
  await expect(page.getByRole("heading")).toContainText("Welcome back");
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill("franchisee");
  await page.getByText("Welcome back").click();
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("heading")).toContainText("The web's best pizza");

  // Click franchise link
  await page
    .getByLabel("Global")
    .getByRole("link", { name: "Franchise" })
    .click();
  await page.getByText("Everything you need to run an").click();
  await expect(page.getByRole("main")).toContainText(
    "Everything you need to run an JWT Pizza franchise. Your gateway to success."
  );

  // Create test store
  await page.getByRole("button", { name: "Create store" }).click();
  await expect(page.getByRole("heading")).toContainText("Create store");
  await page.getByRole("textbox", { name: "store name" }).click();
  await page.getByRole("textbox", { name: "store name" }).fill("testStore");
  await page.getByText("Create store").click();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("tbody")).toContainText("testStore");

  // Close test store
  await page
    .getByRole("row", { name: "testStore 0 ₿ Close" })
    .getByRole("button")
    .click();
  await expect(page.getByRole("main")).toContainText(
    "Are you sure you want to close the pizzaPocket store testStore ? This cannot be restored. All outstanding revenue with not be refunded."
  );
  initialState = true;
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("tbody")).toContainText("SLC");
  await expect(page.locator("tbody")).not.toContainText("testStore");
});

test("about, history, and not found pages", async ({page}) => {
    await page.goto('http://localhost:5173/');
    
    // Click about page
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('main')).toContainText('The secret sauce');

    // Click history page
    await page.getByRole('link', { name: 'History' }).click();
    await expect(page.getByRole('heading')).toContainText('Mama Rucci, my my');

    // Attempt to visit a non existant page
    await page.goto('http://localhost:5173/history/badlink');
    await expect(page.getByRole('main')).toContainText('It looks like we have dropped a pizza on the floor. Please try another page.');
});
