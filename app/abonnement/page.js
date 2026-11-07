"use client";
import { useEffect, useState } from "react";
import Shell from "../../components/Shell";
import Icon from "../../components/Icons";
import { PayInfo, currentUser } from "../../components/Paywall";
import { useLang } from "../../components/Providers";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { daysLeft, formatDay, useAccountStatus } from "../../lib/account";

// Page « Abonnement » : où j'en suis + comment payer (même avant la fin de l'essai)
export default function AbonnementPage() {
  const { t } = useLang();
  const { ready } = useRequireAuth();
  const status = useAccountStatus(ready);
  const [user, setUser] = useState(null);

  useEffect(() => {
    currentUser().then(setUser);
  }, []);

  if (!ready || !status) return <div className="center-screen">…</div>;

  const phone = user && user.email ? user.email.split("@")[0] : "";
  const shop = user && user.user_metadata ? user.user_metadata.shop_name : "";
  const left = daysLeft(status.paid_until);

  return (
    <Shell title={t("sub_title")} backHref="/catalogue" gate={false}>
      {status.paid_until && (
        <div className={`sub-card ${status.access ? "" : "off"}`}>
          <Icon name={status.access ? "check" : "lock"} size={28} />
          <div>
            <b>{status.has_paid ? t("paid_plan") : t("in_trial")}</b>
            <div>
              {t("access_until")} <span dir="ltr">{formatDay(status.paid_until)}</span>
              {left > 0 && (
                <>
                  {" "}
                  (<span dir="ltr">{left}</span> {t("days_word")})
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <PayInfo settings={status.settings || {}} phone={phone} shop={shop} />
    </Shell>
  );
}
