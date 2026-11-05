import { ADMIN_CSS_MEDIA } from "./styles-media";
import { ADMIN_CSS_IMAGES } from "./styles-images";

/** Injects the media/toast CSS once (React 19 dedupes <style href precedence>). */
export function MediaStyles() {
  return (
    <style href="adm-media-css" precedence="default">
      {ADMIN_CSS_MEDIA + ADMIN_CSS_IMAGES}
    </style>
  );
}
