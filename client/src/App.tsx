import { Refine } from "@refinedev/core";
import { notificationProvider, RefineThemes, ThemedLayoutV2 } from "@refinedev/antd";
import { BrowserRouter, Route, Routes, Outlet, Navigate } from "react-router-dom";
import { simpleRestDataProvider } from "@refinedev/simple-rest"; // ✅ fixed import
import { OrderList } from "./pages/orders";
import { ConfigProvider } from "antd";
import "@refinedev/antd/dist/reset.css";

const API_URL = "https://admin.cpapilgrim.shop/api";

export default function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={RefineThemes.Blue}>
        <Refine
          dataProvider={simpleRestDataProvider(API_URL)} // ✅ fixed usage
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
              <Route index element={<Navigate to="/orders" />} /> {/* ✅ redirect root */}
              <Route path="/orders" element={<OrderList />} />
            </Route>
          </Routes>
        </Refine>
      </ConfigProvider>
    </BrowserRouter>
  );
}
