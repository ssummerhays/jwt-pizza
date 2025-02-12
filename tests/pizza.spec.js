import exp from "constants";
import { test, expect } from "playwright-test-coverage";
import { json } from "stream/consumers";

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
    "Are you sure you want to close the pizzaPocket store testStore ? This cannot be restored. All outstanding revenue will not be refunded."
  );
  initialState = true;
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("tbody")).toContainText("SLC");
  await expect(page.locator("tbody")).not.toContainText("testStore");
});

test("about, history, and not found pages", async ({ page }) => {
  await page.goto("http://localhost:5173/");

  // Click about page
  await page.getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("main")).toContainText("The secret sauce");

  // Click history page
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("heading")).toContainText("Mama Rucci, my my");

  // Attempt to visit a non existant page
  await page.goto("http://localhost:5173/history/badlink");
  await expect(page.getByRole("main")).toContainText(
    "It looks like we have dropped a pizza on the floor. Please try another page."
  );
});

test("register new diner, view profile page, and logout", async ({ page }) => {
  let register = true;
  await page.route("*/**/api/auth", async (route) => {
    if (register) {
      const registerReq = {
        name: "testDiner",
        email: "td@jwt.com",
        password: "td",
      };
      const registerRes = {
        user: {
          name: "testDiner",
          email: "td@jwt.com",
          roles: [
            {
              role: "diner",
            },
          ],
          id: 1791,
        },
        token: "abcdef",
      };
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toMatchObject(registerReq);
      await route.fulfill({ json: registerRes });
    } else {
      const logoutRes = {
        message: "logout successful",
      };
      expect(route.request().method()).toBe("DELETE");
      await route.fulfill({ json: logoutRes });
    }
  });

  await page.goto("http://localhost:5173/");

  // Register test diner
  await page.getByRole("link", { name: "Register" }).click();
  await expect(page.getByRole("heading")).toContainText("Welcome to the party");
  await page.getByRole("textbox", { name: "Full name" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("testDiner");
  await page.getByRole("textbox", { name: "Email address" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("td@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill("td");
  await page.getByText("Welcome to the party").click();
  await page.getByRole("button", { name: "Register" }).click();

  // View profile page
  await page.getByRole("link", { name: "t", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("testDiner");
  await expect(page.getByRole("main")).toContainText(
    "How have you lived this long without having a pizza? Buy one now!"
  );

  // Logout test diner
  register = false;
  await page.getByRole("link", { name: "Logout" }).click();
  await expect(page.getByRole("heading")).toContainText("The web's best pizza");
});

test("create and delete test franchise", async ({ page }) => {
  await page.route("**/api/auth", (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        user: {
          id: 913,
          name: "e46b3qqqpm",
          email: "e46b3qqqpm@admin.com",
          roles: [{ role: "admin" }],
        },
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTEzLCJuYW1lIjoiZTQ2YjNxcXFwbSIsImVtYWlsIjoiZTQ2YjNxcXFwbUBhZG1pbi5jb20iLCJyb2xlcyI6W3sicm9sZSI6ImFkbWluIn1dLCJpYXQiOjE3MzkzMzg4Mzl9.ehtMY3aoZdTkyAxOxathixERX6XOetyrS-e3ry9XdBc",
      }),
    });
  });

  let initialState = true;
  await page.route("**/api/franchise", (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          stores: [],
          id: 212,
          name: "test",
          admins: [
            {
              email: "e46b3qqqpm@admin.com",
              id: 913,
              name: "e46b3qqqpm",
            },
          ],
        }),
      });
    } else {
      if (initialState) {
        initialState = !initialState;
        route.fulfill({
          status: 200,
          body: JSON.stringify([
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
          ]),
        });
      } else {
        initialState = !initialState;
        route.fulfill({
          status: 200,
          body: JSON.stringify([
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
            {
              id: 212,
              name: "test",
              admins: [
                {
                  email: "e46b3qqqpm@admin.com",
                  id: 913,
                  name: "e46b3qqqpm",
                },
              ],
              stores: [],
            },
          ]),
        });
      }
    }
  });

  await page.route("**/api/franchise/212", (route) => {
    if (route.request().method() === "DELETE") {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          message: "franchise deleted",
        }),
      });
    }
  });

  await page.goto("http://localhost:5173/");

  // Login admin user
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).click();
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("e46b3qqqpm@admin.com");
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill("toomanysecrets");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page.getByRole("main")).toContainText(
    "Keep the dough rolling and the franchises signing up."
  );
  await expect(page.getByRole("table")).toContainText("pizzaPocket");

  // Navigate to admin dashboard
  await page.getByRole("button", { name: "Add Franchise" }).click();
  await expect(page.locator("form")).toContainText("Want to create franchise?");

  // Create new test franchise
  await page.getByRole("textbox", { name: "franchise name" }).click();
  await page.getByRole("textbox", { name: "franchise name" }).fill("test");
  await page.getByRole("textbox", { name: "franchisee admin email" }).click();
  await page
    .getByRole("textbox", { name: "franchisee admin email" })
    .fill("e46b3qqqpm@admin.com");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("table")).toContainText("test");

  // Close test franchise
  await page
    .getByRole("row", { name: "test e46b3qqqpm Close" })
    .getByRole("button")
    .click();
  await expect(page.getByRole("main")).toContainText(
    "Are you sure you want to close the test franchise? This will close all associated stores and cannot be restored. All outstanding revenue will not be refunded."
  );
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("table")).toContainText("pizzaPocket");
  await expect(page.getByRole("table")).not.toContainText("test");
  await page.getByRole("link", { name: "home" }).click();
});
