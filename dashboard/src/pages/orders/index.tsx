import { Refine } from "@refinedev/core";
import { notificationProvider, RefineThemes, Layout, ThemedLayoutV2 } from "@refinedev/antd";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { dataProvider } from "@refinedev/simple-rest";
import { OrderList } from "./pages/orders";
import { ConfigProvider } from "antd";
import "@refinedev/antd/dist/reset.css";

const API_URL = "https://admin.cpapilgrim.shop/api";

export default function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={RefineThemes.Blue}>
        <Refine
          dataProvider={dataProvider(API_URL)}
          notificationProvider={notificationProvider}
          resources={[
            {
              name: "orders",
              list: "/orders",
            },
          ]}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
          }}
        >
          <Routes>
            <Route element={<ThemedLayoutV2><Outlet /></ThemedLayoutV2>}>
              <Route path="/orders" element={<OrderList />} />
            </Route>
          </Routes>
        </Refine>
      </ConfigProvider>
    </BrowserRouter>
  );
}
