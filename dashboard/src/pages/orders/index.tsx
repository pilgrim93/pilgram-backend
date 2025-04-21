import { Refine } from "@refinedev/core";
import { notificationProvider, RefineThemes, ThemedLayoutV2 } from "@refinedev/antd";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import { dataProvider } from "@refinedev/simple-rest";
import { ConfigProvider, Table } from "antd";
import { useTable } from "@refinedev/antd";
import { Table } from "antd";
import "@refinedev/antd/dist/reset.css";
import React from "react";

const API_URL = "https://admin.cpapilgrim.shop/api";

// ✅ OrderList page component
export const OrderList = () => {
  const { tableProps } = useTable({
    resource: "orders",
  });

  return (
    <Table
      {...tableProps}
      rowKey="order_id"
      columns={[
       { title: "Order ID", dataIndex: "order_id" },
        { title: "Customer Email", dataIndex: "email" },
        { title: "Product", dataIndex: "product" },
        { title: "Price", dataIndex: "price", render: (val) => `$${val.toFixed(2)}` },
        { title: "Date", dataIndex: "created_at", render: (val) => new Date(val).toLocaleString() },
        { title: "Coupon", dataIndex: "coupon_id", render: (val) => val || "—" },
        { title: "Status", dataIndex: "order_status" },
      ]}
    />
  );
};

// ✅ Main Refine app
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
