import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import {
  ManagementRoute,
  ProtectedRoute,
} from "./features/auth/ProtectedRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import KoploDiskoLoader from "./components/koplo-disko-loading/KoploDiskoLoader";
const DashboardPage = lazy(() =>
  import("./features/dashboard/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const EventsPage = lazy(() =>
  import("./features/events/EventsPage").then((m) => ({
    default: m.EventsPage,
  })),
);
const FinancePage = lazy(() =>
  import("./features/finance/FinancePage").then((m) => ({
    default: m.FinancePage,
  })),
);
const MembersPage = lazy(() =>
  import("./features/members/MembersPage").then((m) => ({
    default: m.MembersPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("./features/documents/DocumentsPage").then((m) => ({
    default: m.DocumentsPage,
  })),
);
const ReportsPage = lazy(() =>
  import("./features/reports/ReportsPage").then((m) => ({
    default: m.ReportsPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);
export default function App() {
  return (
    <Suspense
      fallback={
        <KoploDiskoLoader fullscreen size={152} label="Menyiapkan halaman" />
      }
    >
      <Routes>
        <Route path="/masuk" element={<LoginPage />} />
        <Route path="/atur-ulang-kata-sandi" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="jadwal" element={<EventsPage />} />
            <Route path="keuangan" element={<FinancePage />} />
            <Route element={<ManagementRoute />}>
              <Route path="anggota" element={<MembersPage />} />
            </Route>
            <Route path="dokumen" element={<DocumentsPage />} />
            <Route path="laporan" element={<ReportsPage />} />
            <Route path="pengaturan" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
