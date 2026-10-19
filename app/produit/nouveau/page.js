"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../../components/Shell";
import ProductForm from "../../../components/ProductForm";
import { useLang } from "../../../components/Providers";
import { useRequireAuth } from "../../../lib/useRequireAuth";

export default function NewProductPage() {
  const { t } = useLang();
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [barcode, setBarcode] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setBarcode(p.get("barcode") || "");
  }, []);

  if (!ready || barcode === null) return <div className="center-screen">…</div>;

  return (
    <Shell title={t("new_product")} backHref="/catalogue" nav={false}>
      <ProductForm defaultBarcode={barcode} onSaved={() => router.replace("/catalogue")} />
    </Shell>
  );
}
