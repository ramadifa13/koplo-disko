import "./KoploDiskoLoader.css";
import type { CSSProperties } from "react";

type KoploDiskoLoaderProps = {
  fullscreen?: boolean;
  size?: number;
  className?: string;
  label?: string;
};

export default function KoploDiskoLoader({
  fullscreen = false,
  size = 128,
  className = "",
  label = "Sedang memuat",
}: KoploDiskoLoaderProps) {
  return (
    <div
      className={`kd-loader ${fullscreen ? "kd-loader--fullscreen" : ""} ${className}`.trim()}
      style={
        { "--kd-loader-size": `${size}px` } as CSSProperties &
          Record<"--kd-loader-size", string>
      }
      role="status"
      aria-label={label}
    >
      <div className="kd-loader__orbit" aria-hidden="true">
        <span className="kd-loader__glow" />
        <span className="kd-loader__beat kd-loader__beat--one" />
        <span className="kd-loader__beat kd-loader__beat--two" />
        <span className="kd-loader__track" />
        <span className="kd-loader__ring kd-loader__ring--outer" />
        <span className="kd-loader__ring kd-loader__ring--inner" />
        <img
          className="kd-loader__logo"
          src="/logo.png"
          alt=""
          draggable="false"
        />
      </div>
      <div className="kd-loader__copy">
        <span>{label}</span>
        <span className="kd-loader__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
