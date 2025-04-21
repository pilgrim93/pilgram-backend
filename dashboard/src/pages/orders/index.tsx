import { Refine } from "@refinedev/core";
import { notificationProvider, RefineThemes, Layout, ThemedLayoutV2 } from "@refinedev/antd";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { dataProvider } from "@refinedev/simple-rest";
import { OrderList } from "./pages/orders";
import { ConfigProvider } from "antd";
import "@refinedev/antd/dist/reset.css";
import { useTable } from "@refinedev/antd";
import { Table } from "antd";

const API_URL = "https://admin.cpapilgrim.shop/api";
export const OrderList = () => {
  const { tableProps } = useTable({
    resource: "orders",
  });

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

 return (
    <Table
      {...tableProps}
      rowKey="order_id"
      columns={[
        { title: "Order ID", dataIndex: "order_id" },
        { title: "Email", dataIndex: "email" },
        { title: "Product", dataIndex: "product" },
        { title: "Price", dataIndex: "price" },
        { title: "Currency", dataIndex: "currency" },
        { title: "Coupon", dataIndex: "coupon_id" },
        { title: "Created", dataIndex: "created_at" },
        { title: "Status", dataIndex: "order_status" },
      ]}
    />
  );
};