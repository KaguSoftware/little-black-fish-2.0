/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { isVideoUrl, type Bucket } from "@/shared/data/storage";
import { formatNumber } from "@/shared/data/localize";
import type { MediaItem } from "@/shared/actions/admin/types";
import { MediaDialog } from "./MediaDialog";
import { CheckIcon, PhotoIcon, UploadQueue, isHttpUrl, useHintText, useMediaList, useUseLabels } from "./media-lib";
import { acceptFor, useFileDrop, usePasteImages, useUploader, type UploadHints } from "./uploader";

export interface ImagePickerProps {
  bucket: Bucket;
  /** Several images can be chosen. Default: one. */
  multiple?: boolean;
  imagesOnly?: boolean;
  /** Called with the chosen URLs (in the order chosen) when the person confirms. */
  onPick: (urls: string[]) => void;
  onClose: () => void;
  hints?: UploadHints;
  /** Dialog title. Default: "Choose a photo" / "Choose photos". */
  title?: string;
  /** Long edge for uploads made here. */
  maxDimension?: number;
}

type Tab = "library" | "upload" | "link";
type Filter = "all" | "unused";

const isVideo = (m: MediaItem) => m.mimeType.startsWith("video/") || isVideoUrl(m.url);

/** Choose existing media, upload new files or paste a link. Mount to open, onClose to close. */
export function ImagePicker({ bucket, multiple, imagesOnly, onPick, onClose, hints, title, maxDimension }: ImagePickerProps) {
  const t = useTranslations("adminMedia");
  const locale = useLocale();
  const labelOf = useUseLabels();
  const tabsId = useId();
  const searchId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [tab, setTab] = useState<Tab>("library");
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkOk, setLinkOk] = useState<boolean | null>(null);
  const list = useMediaList(bucket);

  const toggle = (url: string) =>
    setPicked((cur) => (cur.includes(url) ? cur.filter((u) => u !== url) : multiple ? [...cur, url] : [url]));

  const uploader = useUploader({
    bucket,
    imagesOnly,
    maxDimension,
    hints,
    onUploaded: (url) => setPicked((cur) => (multiple ? (cur.includes(url) ? cur : [...cur, url]) : [url])),
  });
  const takeFiles = async (files: File[]) => {
    const urls = await uploader.upload(multiple ? files : files.slice(0, 1));
    if (urls.length) {
      void list.refresh();
      setTab("library");
      setQuery("");
      setFilter("all");
    }
  };
  const { over, props: drop } = useFileDrop((f) => void takeFiles(f));
  usePasteImages((f) => void takeFiles(f), true, dialogRef);
  const hintLine = useHintText(hints);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.items ?? []).filter(
      (m) => (!imagesOnly || !isVideo(m)) && (!q || m.name.toLowerCase().includes(q)) && (filter === "all" || m.usedBy.length === 0),
    );
  }, [list.items, query, filter, imagesOnly]);
  const unused = (list.items ?? []).filter((m) => m.usedBy.length === 0 && (!imagesOnly || !isVideo(m))).length;

  const confirm = () => {
    if (picked.length) onPick(picked);
  };

  const checkLink = () => {
    const url = link.trim();
    if (!isHttpUrl(url)) {
      setLinkError(t("link.invalid"));
      setLinkOk(null);
      return false;
    }
    setLinkError("");
    return true;
  };
  const submitLink = () => {
    if (checkLink()) onPick([link.trim()]);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "library", label: t("picker.tabLibrary") },
    { id: "upload", label: uploader.active ? t("picker.tabUploadBusy", { count: uploader.active }) : t("picker.tabUpload") },
    { id: "link", label: t("picker.tabLink") },
  ];
  const noun = multiple ? t("picker.titleMany") : t("picker.titleOne");

  return (
    <MediaDialog
      paste={dialogRef}
      tall
      title={title ?? noun}
      onClose={onClose}
      footer={
        tab === "link" ? (
          <>
            <span className="adm-mdl-foot-note" />
            <div className="adm-mdl-foot-acts">
              <button type="button" className="lbf-textbtn" onClick={onClose}>
                {t("cancel")}
              </button>
              <button type="button" className="lbf-cta" onClick={submitLink} disabled={!link.trim()}>
                <span>{t("link.use")}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="adm-mdl-foot-note" aria-live="polite">
              {picked.length ? (multiple ? t("picker.selectedCount", { count: picked.length }) : t("picker.selectedOne")) : t("picker.nothingSelected")}
            </span>
            <div className="adm-mdl-foot-acts">
              {picked.length > 0 && multiple && (
                <button type="button" className="lbf-textbtn" onClick={() => setPicked([])}>
                  {t("picker.clear")}
                </button>
              )}
              <button type="button" className="lbf-textbtn" onClick={onClose}>
                {t("cancel")}
              </button>
              <button type="button" className="lbf-cta" onClick={confirm} disabled={picked.length === 0}>
                <span>{multiple ? t("picker.useMany", { count: picked.length }) : t("picker.useOne")}</span>
              </button>
            </div>
          </>
        )
      }
    >
      <div className="adm-tabs" role="tablist" aria-label={t("picker.tabs")} onKeyDown={(e) => {
        const i = tabs.findIndex((x) => x.id === tab);
        const dir = document.dir === "rtl" ? -1 : 1;
        const next = e.key === "ArrowRight" ? i + dir : e.key === "ArrowLeft" ? i - dir : null;
        if (next === null) return;
        e.preventDefault();
        const n = tabs[(next + tabs.length) % tabs.length];
        setTab(n.id);
        document.getElementById(`${tabsId}-${n.id}`)?.focus();
      }}>
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`${tabsId}-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls={`${tabsId}-panel`}
            tabIndex={tab === x.id ? 0 : -1}
            className="adm-tab"
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="adm-pk-panel" {...drop} data-over={over ? "true" : "false"}>
        {over && (
          <div className="adm-drop-veil" aria-hidden="true">
            <PhotoIcon />
            <span>{multiple ? t("drop.many") : t("drop.one")}</span>
          </div>
        )}

        {tab === "library" && (
          <>
            <UploadQueue uploader={uploader} compact />
            <div className="adm-lib-tools">
              <div className="lbf-field adm-lib-search">
                <label className="lbf-label" htmlFor={searchId}>
                  {t("library.search")}
                </label>
                <input id={searchId} className="lbf-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
              </div>
              <div className="adm-chips" role="group" aria-label={t("library.filter")}>
                <button type="button" className="adm-chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                  {t("library.all")}
                </button>
                <button type="button" className="adm-chip" aria-pressed={filter === "unused"} onClick={() => setFilter("unused")}>
                  {t("library.unused")} <span className="adm-chip-n">{formatNumber(unused, locale)}</span>
                </button>
              </div>
            </div>

            {list.error ? (
              <div className="adm-empty" role="alert">
                <p className="adm-empty-title">{t("library.errorTitle")}</p>
                <p className="adm-empty-text">{list.error}</p>
                <button type="button" className="lbf-textbtn" onClick={() => void list.refresh()}>
                  {t("retry")}
                </button>
              </div>
            ) : list.items === null ? (
              <div className="adm-grid" aria-busy="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="adm-card-skel" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="adm-empty">
                <p className="adm-empty-title">{list.items.length === 0 ? t("library.emptyTitle") : t("library.noMatchTitle")}</p>
                <p className="adm-empty-text">{list.items.length === 0 ? t("library.emptyText") : t("library.noMatchText")}</p>
                {list.items.length === 0 && (
                  <button type="button" className="lbf-textbtn" onClick={() => setTab("upload")}>
                    {t("picker.goUpload")}
                  </button>
                )}
              </div>
            ) : (
              <>
                <ul className="adm-grid" aria-label={t("library.files")}>
                  {shown.map((m) => {
                    const on = picked.includes(m.url);
                    const order = multiple && on ? picked.indexOf(m.url) + 1 : 0;
                    const uses = m.usedBy.map((u) => labelOf(u).text);
                    return (
                      <li key={m.path}>
                        <button
                          type="button"
                          className="adm-card"
                          aria-pressed={on}
                          onClick={() => toggle(m.url)}
                          onDoubleClick={() => !multiple && onPick([m.url])}
                          title={uses.length ? `${m.name}\n${t("library.usedIn")}: ${uses.join(", ")}` : m.name}
                        >
                          <span className="adm-card-img">
                            {isVideo(m) ? <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" /> : <img src={m.url} alt="" loading="lazy" decoding="async" />}
                            <span className="adm-card-check" aria-hidden="true">
                              {order ? <b>{formatNumber(order, locale)}</b> : <CheckIcon />}
                            </span>
                          </span>
                          <span className="adm-card-name" dir="ltr">
                            {m.name}
                          </span>
                          <span className="adm-card-use" data-used={uses.length ? "true" : "false"}>
                            {uses.length ? (uses.length === 1 ? uses[0] : t("library.usedInN", { count: uses.length })) : t("library.unusedBadge")}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {list.hasMore && (
                  <div className="adm-more-row">
                    <button type="button" className="lbf-textbtn" onClick={() => void list.loadMore()} disabled={list.loadingMore} aria-busy={list.loadingMore}>
                      {list.loadingMore ? t("library.loading") : t("library.loadMore")}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "upload" && (
          <div className="adm-pk-up">
            <label className="adm-zone adm-zone-big" data-over={over ? "true" : "false"}>
              <PhotoIcon />
              <span className="adm-zone-title">{multiple ? t("drop.many") : t("drop.one")}</span>
              <span className="adm-zone-sub">{t("drop.or")}</span>
              <span className="lbf-cta adm-zone-btn">
                <span>{multiple ? t("upload.chooseMany") : t("upload.choose")}</span>
              </span>
              <span className="adm-zone-hint">{[hintLine, t("upload.paste")].filter(Boolean).join(" · ")}</span>
              <input
                type="file"
                className="adm-zone-input"
                accept={acceptFor(imagesOnly)}
                multiple={multiple}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) void takeFiles(files);
                }}
              />
            </label>
            <UploadQueue uploader={uploader} />
          </div>
        )}

        {tab === "link" && (
          <div className="adm-pk-link">
            <div className="lbf-field">
              <label className="lbf-label" htmlFor={`${tabsId}-link`}>
                {t("link.label")}
              </label>
              <input
                id={`${tabsId}-link`}
                className="lbf-input"
                type="url"
                dir="ltr"
                inputMode="url"
                placeholder="https://"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setLinkError("");
                  setLinkOk(null);
                }}
                onBlur={() => link.trim() && checkLink()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitLink();
                  }
                }}
                aria-invalid={linkError ? true : undefined}
                aria-describedby={`${tabsId}-link-hint${linkError ? ` ${tabsId}-link-err` : ""}`}
              />
              <span className="lbf-hint" id={`${tabsId}-link-hint`}>
                {t("link.hint")}
              </span>
              {linkError && (
                <span className="lbf-error" id={`${tabsId}-link-err`} role="alert">
                  {linkError}
                </span>
              )}
            </div>
            {isHttpUrl(link) && (
              <div className="adm-link-prev" data-ok={linkOk === false ? "false" : "true"}>
                <img src={link.trim()} alt="" onLoad={() => setLinkOk(true)} onError={() => setLinkOk(false)} />
                {linkOk === false && <p className="adm-link-warn">{t("link.cantPreview")}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </MediaDialog>
  );
}
