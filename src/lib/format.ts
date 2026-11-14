import { format } from "date-fns";
import { id } from "date-fns/locale";
export const formatRupiah = (value: number | bigint) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
export const formatTanggal = (value: string | Date, pattern = "d MMMM yyyy") =>
  format(new Date(value), pattern, { locale: id });
export const formatTanggalWaktu = (value: string | Date) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
