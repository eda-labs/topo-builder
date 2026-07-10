/**
 * Official Nokia references per platform family: the product page (which hosts the datasheets)
 * and the hardware documentation / installation guide hub.
 */
export interface PlatformLinks {
  family: string;
  /** nokia.com product page carrying the datasheet downloads */
  datasheetUrl: string;
  /** documentation.nokia.com hardware/installation guides */
  docsUrl: string;
}

const FAMILY_LINKS: readonly PlatformLinks[] = [
  {
    family: '7215 IXS',
    datasheetUrl: 'https://documentation.nokia.com/pybin/doc_ctr.py?entry_id=1-0000000004373',
    docsUrl: 'https://documentation.nokia.com/pybin/doc_ctr.py?product_id=833-066294&model=754&model_name=Hardware&category=Installation&sortby=Issue%20Date',
  },
  {
    family: '7220 IXR',
    datasheetUrl: 'https://www.nokia.com/data-center-networks/data-center-fabric/7220-interconnect-router/',
    docsUrl: 'https://documentation.nokia.com/pybin/doc_ctr.py?product_id=833-064480&model=753&model_name=Hardware&category=Installation&sortby=Issue%20Date',
  },
  {
    family: '7250 IXR',
    datasheetUrl: 'https://www.nokia.com/ip-networks/7250-interconnect-router/',
    docsUrl: 'https://documentation.nokia.com/pybin/doc_ctr.py?product_id=833-011541&model=660&model_name=Hardware&category=Installation&sortby=Issue%20Date',
  },
  {
    family: '7730 SXR',
    datasheetUrl: 'https://www.nokia.com/ip-networks/7730-sxr/',
    docsUrl: 'https://documentation.nokia.com/pybin/doc_ctr.py?product_id=833-081666&category=Installation&sortby=Issue%20Date',
  },
  {
    family: '7750 SR',
    datasheetUrl: 'https://www.nokia.com/ip-networks/7750-service-router/',
    docsUrl: 'https://documentation.nokia.com/pybin/doc_ctr.py?product_id=833-006358&model=562&model_name=Hardware&category=Installation&sortby=Issue%20Date',
  },
];

export function platformLinks(platform: string): PlatformLinks | undefined {
  const value = platform.trim().replace(/\s+/g, ' ').toUpperCase();
  return FAMILY_LINKS.find(links => {
    const prefix = links.family.toUpperCase();
    return value === prefix || value.startsWith(`${prefix}-`) || value.startsWith(`${prefix} `);
  });
}
