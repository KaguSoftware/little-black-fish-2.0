/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { Bucket } from "@/shared/data/storage";
import { ImageField } from "./ImageField";
import { ImagePicker } from "./ImagePicker";
import { MediaStyles } from "./MediaStyles";

/**
 * A picture that has a built-in default. Nothing chosen: shows the built-in picture with a
 * "Built-in" tag and one button to change it. Chosen: a normal ImageField whose Remove reads
 * "Use built-in". Either way the person sees what the site shows right now.
 */
export function ImageSlot({
  label,
  description,
  value,
  onChange,
  builtIn,
  aspect = "16/9",
  bucket = "projects",
}: {
  label: string;
  description?: string;
  /** Chosen picture, "" = built-in. */
  value: string;
  onChange: (url: string) => void;
  builtIn: string | null;
  aspect?: string;
  bucket?: Bucket;
}) {
  const t = useTranslations("adminMedia");
  const id = useId();
  const [picking, setPicking] = useState(false);
  if (value) {
    return <ImageField label={label} description={description} value={value} onChange={onChange} bucket={bucket} imagesOnly aspect={aspect} builtIn={!!builtIn} />;
  }
  return (
    <div className="vi-def lbf-field">
      <MediaStyles />
      <span className="lbf-label" id={`${id}-l`}>
        {label}
      </span>
      {description && <span className="lbf-hint">{description}</span>}
      <button type="button" className="vi-box" style={{ aspectRatio: aspect, padding: 0, cursor: "pointer" }} onClick={() => setPicking(true)} aria-labelledby={`${id}-l ${id}-a`}>
        {builtIn ? <img src={builtIn} alt="" loading="lazy" decoding="async" /> : null}
        <span className="vi-tag">{t("images.status.builtIn")}</span>
      </button>
      <div>
        <button type="button" className="adm-btn" id={`${id}-a`} onClick={() => setPicking(true)}>
          {t("images.changePicture")}
        </button>
      </div>
      {picking && (
        <ImagePicker
          bucket={bucket}
          imagesOnly
          title={t("field.pickTitle", { label })}
          onClose={() => setPicking(false)}
          onPick={(urls) => {
            setPicking(false);
            if (urls[0]) onChange(urls[0]);
          }}
        />
      )}
    </div>
  );
}
