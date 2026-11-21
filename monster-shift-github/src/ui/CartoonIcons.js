/**
 * High-Craft Multi-Layered Cartoon SVG Icons & Rank Emblems for MONSTER SHIFT.
 * - Uses layered highlights, bevel shadows, sparkle glints & crisp #14192b comic ink borders.
 * - Zero shared <defs> IDs so icons render crisply even when repeated dozens of times on screen.
 */
const SVG_OPEN = `<svg class="toon-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">`;

export const ICONS = {
  coin: `${SVG_OPEN}
    <circle cx="18" cy="18.6" r="14.2" fill="#D97A00" stroke="#14192B" stroke-width="3.2"/>
    <circle cx="18" cy="17.6" r="13.2" fill="#FFBE1A" stroke="#14192B" stroke-width="3"/>
    <circle cx="18" cy="17.6" r="9.4" fill="#FFE666" stroke="#D97A00" stroke-width="2"/>
    <path d="M11 11.5C13.2 9.2 16.2 8.4 19.6 8.8" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>
    <path d="M18 11.6V23.6M14.8 14.4H21.2M15.2 21H20.8" stroke="#14192B" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  shard: `${SVG_OPEN}
    <polygon points="18,2.8 31.5,18 18,33.2 4.5,18" fill="#8C32FF" stroke="#14192B" stroke-width="3.2" stroke-linejoin="round"/>
    <polygon points="18,4.6 29,18 18,18" fill="#C97BFF"/>
    <polygon points="18,4.6 7,18 18,18" fill="#E8C2FF"/>
    <polygon points="18,31.2 29,18 18,18" fill="#6F1FE6"/>
    <polygon points="18,10.5 23.2,18 18,25.5 12.8,18" fill="#F5E0FF" stroke="#14192B" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="14.5" cy="12" r="1.8" fill="#FFFFFF"/>
  </svg>`,

  pack: `${SVG_OPEN}
    <rect x="6" y="4" width="24" height="28" rx="5.5" fill="#FF6B14" stroke="#14192B" stroke-width="3.2"/>
    <rect x="6" y="4" width="24" height="7" rx="3" fill="#FFE047" stroke="#14192B" stroke-width="2.8"/>
    <rect x="6" y="25" width="24" height="7" rx="3" fill="#FF9C24" stroke="#14192B" stroke-width="2.8"/>
    <path d="M9.5 13.5L23.5 11.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
    <polygon points="18,12 20.5,16.4 25.5,17.1 21.9,20.6 22.8,25.2 18,22.9 13.2,25.2 14.1,20.6 10.5,17.1 15.5,16.4" fill="#FFE047" stroke="#14192B" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="16.4" cy="16.8" r="1.4" fill="#FFFFFF"/>
  </svg>`,

  star: `${SVG_OPEN}
    <polygon points="18,3 22.8,12.4 33.2,13.9 25.6,21.3 27.4,31.8 18,26.8 8.6,31.8 10.4,21.3 2.8,13.9 13.2,12.4" fill="#FFBE1A" stroke="#14192B" stroke-width="3.2" stroke-linejoin="round"/>
    <polygon points="18,6.5 21.4,13.5 29,14.6 23.4,20 24.7,27.5 18,24 11.3,27.5 12.6,20 7,14.6 14.6,13.5" fill="#FFE866"/>
    <circle cx="15" cy="14" r="2.2" fill="#FFFFFF" opacity="0.9"/>
  </svg>`,

  none: `${SVG_OPEN}
    <circle cx="18" cy="18" r="12.5" fill="#E6EEF9" stroke="#14192B" stroke-width="3"/>
    <circle cx="18" cy="18" r="8.5" fill="#F7FAFF"/>
    <line x1="10.5" y1="25.5" x2="25.5" y2="10.5" stroke="#FF4757" stroke-width="3.6" stroke-linecap="round"/>
  </svg>`,

  sprout: `${SVG_OPEN}
    <path d="M18 31V15" stroke="#14192B" stroke-width="4" stroke-linecap="round"/>
    <path d="M18 31V15" stroke="#22B84A" stroke-width="2" stroke-linecap="round"/>
    <path d="M18 17C9.5 17 5.5 10.8 7.8 5.5C14.2 5.5 18 9.8 18 17Z" fill="#52F270" stroke="#14192B" stroke-width="3" stroke-linejoin="round"/>
    <path d="M10.5 9C12.5 9.5 14.5 11.5 15.8 14" stroke="#B8FFCA" stroke-width="2" stroke-linecap="round"/>
    <path d="M18 19C26.5 19 30.5 12.8 28.2 7.5C21.8 7.5 18 11.8 18 19Z" fill="#29C752" stroke="#14192B" stroke-width="3" stroke-linejoin="round"/>
  </svg>`,

  crown: `${SVG_OPEN}
    <path d="M4.5 26L6.8 10.5L13.5 17.5L18 7.5L22.5 17.5L29.2 10.5L31.5 26H4.5Z" fill="#FFCA28" stroke="#14192B" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M8.5 24L9.8 14.5L14 19L18 11.5L22 19L26.2 14.5L27.5 24Z" fill="#FFF08A"/>
    <rect x="5.5" y="24.8" width="25" height="6" rx="2.5" fill="#FF8C1A" stroke="#14192B" stroke-width="3"/>
    <circle cx="18" cy="20.5" r="2.8" fill="#FF3B5C" stroke="#14192B" stroke-width="1.8"/>
    <circle cx="11.5" cy="21.2" r="2" fill="#38D4FF" stroke="#14192B" stroke-width="1.5"/>
    <circle cx="24.5" cy="21.2" r="2" fill="#38D4FF" stroke="#14192B" stroke-width="1.5"/>
  </svg>`,

  party: `${SVG_OPEN}
    <polygon points="18,6 29.5,30 6.5,30" fill="#FF4D88" stroke="#14192B" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M11 23.5H25M13.8 16.5H22.2" stroke="#FFE047" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="18" cy="6" r="4.4" fill="#FFE047" stroke="#14192B" stroke-width="2.8"/>
    <circle cx="16.8" cy="4.8" r="1.3" fill="#FFFFFF"/>
  </svg>`,

  shades: `${SVG_OPEN}
    <rect x="2.5" y="12.5" width="13.5" height="11" rx="4.2" fill="#1C2338" stroke="#14192B" stroke-width="3"/>
    <rect x="20" y="12.5" width="13.5" height="11" rx="4.2" fill="#1C2338" stroke="#14192B" stroke-width="3"/>
    <path d="M16 16.5H20" stroke="#FF7A1A" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M5.8 15.5L10.5 20.5M23.3 15.5L28 20.5" stroke="#5CEBFF" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="12.8" cy="15.5" r="1.2" fill="#FFFFFF"/>
    <circle cx="30.3" cy="15.5" r="1.2" fill="#FFFFFF"/>
  </svg>`,

  halo: `${SVG_OPEN}
    <ellipse cx="18" cy="18" rx="13.5" ry="6.8" fill="none" stroke="#14192B" stroke-width="7.4"/>
    <ellipse cx="18" cy="18" rx="13.5" ry="6.8" fill="none" stroke="#FFBE1A" stroke-width="4"/>
    <path d="M8.5 14.5C11.5 12.2 15 11.4 19 11.4" stroke="#FFF9B8" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  bubbles: `${SVG_OPEN}
    <circle cx="13.5" cy="21" r="9.4" fill="#4CE0FF" stroke="#14192B" stroke-width="3"/>
    <circle cx="13.5" cy="21" r="6.8" fill="#9AF2FF"/>
    <circle cx="25.2" cy="12.6" r="6.4" fill="#88EEFF" stroke="#14192B" stroke-width="2.8"/>
    <circle cx="10.2" cy="17.5" r="2.4" fill="#FFFFFF"/>
    <circle cx="23.2" cy="10.4" r="1.8" fill="#FFFFFF"/>
  </svg>`,

  rainbow: `${SVG_OPEN}
    <path d="M4.5 27.5A13.5 13.5 0 0 1 31.5 27.5" stroke="#14192B" stroke-width="11.5" stroke-linecap="round"/>
    <path d="M4.5 27.5A13.5 13.5 0 0 1 31.5 27.5" stroke="#FF4764" stroke-width="7" stroke-linecap="round"/>
    <path d="M8.5 27.5A9.5 9.5 0 0 1 27.5 27.5" stroke="#FFE047" stroke-width="4.6" stroke-linecap="round"/>
    <path d="M12.5 27.5A5.5 5.5 0 0 1 23.5 27.5" stroke="#36C9FF" stroke-width="4" stroke-linecap="round"/>
  </svg>`,

  starlight: `${SVG_OPEN}
    <path d="M18 3.2L21.6 14.4L32.8 18L21.6 21.6L18 32.8L14.4 21.6L3.2 18L14.4 14.4Z" fill="#FFE047" stroke="#14192B" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="18" cy="18" r="4.2" fill="#FFFFFF"/>
  </svg>`,

  flame: `${SVG_OPEN}
    <path d="M18 3.2C23.5 10.5 29.5 14 28.4 22.2C27.6 28.2 23.2 32.5 18 32.5C12 32.5 7.6 27.8 7.6 22C7.6 16 11.8 11.8 14 9.5C14 13.8 16 14.8 17 13.8C17 8.8 18 3.2 18 3.2Z" fill="#FF5514" stroke="#14192B" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M18 14.5C21.5 18.8 23.2 22.8 22 26.8C21 29.4 15 29.4 14 26.8C12.8 22.8 14.5 18.8 18 14.5Z" fill="#FFE047"/>
    <circle cx="17.8" cy="24.8" r="2.5" fill="#FFFFFF"/>
  </svg>`,

  monsterBadge: `${SVG_OPEN}
    <path d="M6.5 24C6.5 13.5 11.2 7.5 18 7.5C24.8 7.5 29.5 13.5 29.5 24C29.5 28.4 25.2 30.5 18 30.5C10.8 30.5 6.5 28.4 6.5 24Z" fill="#35E673" stroke="#14192B" stroke-width="3.2"/>
    <path d="M11 12C13 9.8 16 9.2 19 9.5" stroke="#B8FFD0" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="13.4" cy="18.2" r="3.2" fill="#FFFFFF" stroke="#14192B" stroke-width="1.8"/>
    <circle cx="22.6" cy="18.2" r="3.2" fill="#FFFFFF" stroke="#14192B" stroke-width="1.8"/>
    <circle cx="13.8" cy="18.2" r="1.5" fill="#14192B"/>
    <circle cx="23" cy="18.2" r="1.5" fill="#14192B"/>
    <ellipse cx="9.8" cy="21.5" rx="2" ry="1.2" fill="#FF73A1"/>
    <ellipse cx="26.2" cy="21.5" rx="2" ry="1.2" fill="#FF73A1"/>
    <path d="M14.2 24Q18 27.2 21.8 24" stroke="#14192B" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  survivorBadge: `${SVG_OPEN}
    <circle cx="18" cy="14" r="8.2" fill="#FFE1C6" stroke="#14192B" stroke-width="3"/>
    <path d="M9.8 13C11 6.5 25 6.5 26.2 13Z" fill="#FF6B14" stroke="#14192B" stroke-width="3" stroke-linejoin="round"/>
    <rect x="10.5" y="22.2" width="15" height="9.2" rx="4.2" fill="#2A9EFF" stroke="#14192B" stroke-width="3"/>
    <circle cx="14.8" cy="15.2" r="1.6" fill="#14192B"/>
    <circle cx="21.2" cy="15.2" r="1.6" fill="#14192B"/>
    <path d="M15.6 18.8Q18 20.6 20.4 18.8" stroke="#14192B" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  weapon: `${SVG_OPEN}
    <rect x="5" y="11" width="23" height="10.5" rx="4" fill="#FF6E14" stroke="#14192B" stroke-width="3"/>
    <rect x="8.5" y="13.2" width="14" height="3" rx="1.5" fill="#FFB85C"/>
    <rect x="8.5" y="21" width="7.2" height="9.5" rx="2.4" fill="#394666" stroke="#14192B" stroke-width="3"/>
    <circle cx="28.5" cy="16.2" r="4.4" fill="#FFE047" stroke="#14192B" stroke-width="2.8"/>
    <circle cx="27.5" cy="15.2" r="1.3" fill="#FFFFFF"/>
  </svg>`,

  weaponBadge: `${SVG_OPEN}
    <rect x="5" y="11" width="23" height="10.5" rx="4" fill="#FF6E14" stroke="#14192B" stroke-width="3"/>
    <rect x="8.5" y="13.2" width="14" height="3" rx="1.5" fill="#FFB85C"/>
    <rect x="8.5" y="21" width="7.2" height="9.5" rx="2.4" fill="#394666" stroke="#14192B" stroke-width="3"/>
    <circle cx="28.5" cy="16.2" r="4.4" fill="#FFE047" stroke="#14192B" stroke-width="2.8"/>
  </svg>`,

  skinBadge: `${SVG_OPEN}
    <path d="M18 4.8C25.2 4.8 31.2 10.8 31.2 17C31.2 21.2 28.2 23.2 24 23.2C22 23.2 21 24.6 22 26.6C23 28.6 21 31.2 17.4 31.2C10.2 31.2 4.8 25.2 4.8 18C4.8 10.2 10.8 4.8 18 4.8Z" fill="#FFE05D" stroke="#14192B" stroke-width="3"/>
    <circle cx="13" cy="13.8" r="2.8" fill="#FF4764" stroke="#14192B" stroke-width="1.8"/>
    <circle cx="21.4" cy="12" r="2.8" fill="#269BFF" stroke="#14192B" stroke-width="1.8"/>
    <circle cx="12" cy="22" r="2.8" fill="#2EE068" stroke="#14192B" stroke-width="1.8"/>
  </svg>`,

  catEars: `${SVG_OPEN}
    <polygon points="5.5,27 9.8,7.5 17.2,22" fill="#FF8C1A" stroke="#14192B" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="30.5,27 26.2,7.5 18.8,22" fill="#FF8C1A" stroke="#14192B" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="9.5,23 11.4,13.2 15.2,21" fill="#FFB8D2"/>
    <polygon points="26.5,23 24.6,13.2 20.8,21" fill="#FFB8D2"/>
  </svg>`,

  chefHat: `${SVG_OPEN}
    <circle cx="11.5" cy="15" r="6.2" fill="#FFFFFF" stroke="#14192B" stroke-width="3"/>
    <circle cx="24.5" cy="15" r="6.2" fill="#FFFFFF" stroke="#14192B" stroke-width="3"/>
    <circle cx="18" cy="11.8" r="7.2" fill="#FFFFFF" stroke="#14192B" stroke-width="3"/>
    <rect x="8.5" y="20" width="19" height="9.2" rx="2.8" fill="#FFF3D6" stroke="#14192B" stroke-width="3"/>
    <line x1="13" y1="22.5" x2="13" y2="27" stroke="#D9C5A0" stroke-width="2" stroke-linecap="round"/>
    <line x1="18" y1="22.5" x2="18" y2="27" stroke="#D9C5A0" stroke-width="2" stroke-linecap="round"/>
    <line x1="23" y1="22.5" x2="23" y2="27" stroke="#D9C5A0" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  viking: `${SVG_OPEN}
    <path d="M8.5 24C8.5 14.5 12.8 10.5 18 10.5C23.2 10.5 27.5 14.5 27.5 24Z" fill="#6E82A6" stroke="#14192B" stroke-width="3"/>
    <path d="M12.5 14.5C14 12.6 16.5 12.2 19 12.5" stroke="#B8CBE6" stroke-width="2" stroke-linecap="round"/>
    <path d="M8.5 18C3.5 16 2.8 9.8 5.8 6.5C7 10.8 8.8 12.8 11 13.8" fill="#FFF2C2" stroke="#14192B" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="M27.5 18C32.5 16 33.2 9.8 30.2 6.5C29 10.8 27.2 12.8 25 13.8" fill="#FFF2C2" stroke="#14192B" stroke-width="2.8" stroke-linejoin="round"/>
    <rect x="6.5" y="23" width="23" height="5.5" rx="2.2" fill="#FFBE1A" stroke="#14192B" stroke-width="2.8"/>
  </svg>`,

  wizard: `${SVG_OPEN}
    <ellipse cx="18" cy="27.2" rx="14.2" ry="4.6" fill="#6B38E6" stroke="#14192B" stroke-width="3"/>
    <polygon points="18,3.8 28.2,26 7.8,26" fill="#8C5CFF" stroke="#14192B" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="18,12.5 19.6,16.2 23.5,16.6 20.6,19.2 21.4,23 18,21 14.6,23 15.4,19.2 12.5,16.6 16.4,16.2" fill="#FFE047" stroke="#14192B" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>`,

  propeller: `${SVG_OPEN}
    <path d="M6.8 26.2C6.8 16 11.8 12 18 12C24.2 12 29.2 16 29.2 26.2Z" fill="#269BFF" stroke="#14192B" stroke-width="3"/>
    <path d="M18 12V26" stroke="#FFE047" stroke-width="3"/>
    <rect x="5.5" y="6.8" width="25" height="5.2" rx="2.6" fill="#FF6E14" stroke="#14192B" stroke-width="2.8"/>
    <circle cx="18" cy="9.4" r="3.2" fill="#FFE047" stroke="#14192B" stroke-width="2.4"/>
  </svg>`,

  dragonCrown: `${SVG_OPEN}
    <path d="M7.5 26L4.5 7.5L13 17.5L18 5.2L23 17.5L31.5 7.5L28.5 26Z" fill="#FF4700" stroke="#14192B" stroke-width="3" stroke-linejoin="round"/>
    <path d="M10.5 24L9.2 13.5L14 19.5L18 10L22 19.5L26.8 13.5L25.5 24Z" fill="#FFAE1A"/>
    <rect x="6.5" y="24" width="23" height="6.2" rx="2.2" fill="#FFCA28" stroke="#14192B" stroke-width="3"/>
  </svg>`,

  aura: `${SVG_OPEN}
    <circle cx="18" cy="18" r="12.8" fill="none" stroke="#14192B" stroke-width="6.8"/>
    <circle cx="18" cy="18" r="12.8" fill="none" stroke="#FF8C1A" stroke-width="3.4"/>
    <circle cx="18" cy="5.2" r="3.8" fill="#FFE047" stroke="#14192B" stroke-width="2.2"/>
    <circle cx="29.5" cy="22.5" r="3.8" fill="#4CE0FF" stroke="#14192B" stroke-width="2.2"/>
    <circle cx="6.5" cy="22.5" r="3.8" fill="#FF52A8" stroke="#14192B" stroke-width="2.2"/>
  </svg>`,

  heart: `${SVG_OPEN}
    <path d="M18 30.5C18 30.5 5.5 22 5.5 13.5C5.5 9.2 8.8 6.2 12.8 6.2C15.2 6.2 17 7.6 18 9.6C19 7.6 20.8 6.2 23.2 6.2C27.2 6.2 30.5 9.2 30.5 13.5C30.5 22 18 30.5 18 30.5Z" fill="#FF477E" stroke="#14192B" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M9.5 12.5C9.5 10.2 11.2 9.2 13 9.2" stroke="#FFC2D6" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  bolt: `${SVG_OPEN}
    <polygon points="21.5,3.5 8.5,20 17,20 14.5,32.5 27.5,16 19,16" fill="#FFE047" stroke="#14192B" stroke-width="3.2" stroke-linejoin="round"/>
    <polygon points="19.5,8.5 12.5,18 18,18" fill="#FFFFFF" opacity="0.7"/>
  </svg>`,

  snowflake: `${SVG_OPEN}
    <path d="M18 4V32M5.8 11L30.2 25M30.2 11L5.8 25" stroke="#14192B" stroke-width="6.4" stroke-linecap="round"/>
    <path d="M18 4V32M5.8 11L30.2 25M30.2 11L5.8 25" stroke="#5CEBFF" stroke-width="3" stroke-linecap="round"/>
    <circle cx="18" cy="18" r="3.4" fill="#FFFFFF" stroke="#14192B" stroke-width="2"/>
  </svg>`,

  blossom: `${SVG_OPEN}
    <circle cx="18" cy="9.8" r="5.2" fill="#FF8AC2" stroke="#14192B" stroke-width="2.6"/>
    <circle cx="25.8" cy="15.4" r="5.2" fill="#FF8AC2" stroke="#14192B" stroke-width="2.6"/>
    <circle cx="22.8" cy="24.6" r="5.2" fill="#FF8AC2" stroke="#14192B" stroke-width="2.6"/>
    <circle cx="13.2" cy="24.6" r="5.2" fill="#FF8AC2" stroke="#14192B" stroke-width="2.6"/>
    <circle cx="10.2" cy="15.4" r="5.2" fill="#FF8AC2" stroke="#14192B" stroke-width="2.6"/>
    <circle cx="18" cy="18" r="4.4" fill="#FFE047" stroke="#14192B" stroke-width="2.4"/>
    <circle cx="16.8" cy="16.8" r="1.4" fill="#FFFFFF"/>
  </svg>`,

  sweetPotato: `${SVG_OPEN}
    <path d="M10 10C11 6 14 6 14 9" stroke="#FFF4B8" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M18 8C19 4 22 4 22 8" stroke="#FFF4B8" stroke-width="2.8" stroke-linecap="round"/>
    <ellipse cx="17.5" cy="21" rx="12.5" ry="8.8" transform="rotate(-18 17.5 21)" fill="#9E2B6B" stroke="#14192B" stroke-width="3.2"/>
    <path d="M9.5 18C12 15.8 15.5 14.8 18.5 15" stroke="#D966A8" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="23.5" cy="18.4" rx="5.4" ry="6.4" transform="rotate(-18 23.5 18.4)" fill="#FFCE38" stroke="#14192B" stroke-width="2.8"/>
    <circle cx="23.5" cy="18.2" r="2.4" fill="#FFF7B8"/>
  </svg>`,
};

export function renderIcon(name, size = 24) {
  const raw = ICONS[name] || ICONS.star;
  return `<span class="toon-icon-wrap" style="width:${size}px;height:${size}px">${raw}</span>`;
}

const RANK_EMBLEMS = {
  bronze: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4L41 11.5V25C41 34.5 32.5 41.5 24 44.5C15.5 41.5 7 34.5 7 25V11.5L24 4Z" fill="#B56522" stroke="#14192B" stroke-width="3.6" stroke-linejoin="round"/>
    <path d="M24 8.5L36.5 14V24.5C36.5 31.8 30.4 37.2 24 39.6C17.6 37.2 11.5 31.8 11.5 24.5V14L24 8.5Z" fill="#E89A54" stroke="#14192B" stroke-width="2.4"/>
    <path d="M24 8.5L11.5 14V24.5C11.5 31.8 17.6 37.2 24 39.6V8.5Z" fill="#F8C28B" opacity="0.55"/>
    <polygon points="24,16 29.5,24 24,32 18.5,24" fill="#7A3E10" stroke="#14192B" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="22.5" cy="22" r="2" fill="#FFE0B5"/>
  </svg>`,

  silver: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 15L13 20.5L9.5 30.5L3 24V15Z" fill="#E6F0FA" stroke="#14192B" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="M45 15L35 20.5L38.5 30.5L45 24V15Z" fill="#C4D5E8" stroke="#14192B" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="M24 4.5L39 11.5V25C39 34.2 31.5 40.5 24 43.5C16.5 40.5 9 34.2 9 25V11.5L24 4.5Z" fill="#A9BCD4" stroke="#14192B" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M24 8L12.5 13.5V24.5C12.5 31.5 18 36.8 24 39.2V8Z" fill="#E8F3FF" opacity="0.7"/>
    <polygon points="24,12.5 27.6,20.2 35.5,21.2 29.6,26.8 31.2,34.5 24,30.8 16.8,34.5 18.4,26.8 12.5,21.2 20.4,20.2" fill="#FFFFFF" stroke="#14192B" stroke-width="2.4" stroke-linejoin="round"/>
  </svg>`,

  gold: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.5 33L3.5 13L15 20.5L24 6L33 20.5L44.5 13L41.5 33H6.5Z" fill="#FFAE00" stroke="#14192B" stroke-width="3.6" stroke-linejoin="round"/>
    <path d="M10.5 30.5L8.8 18.5L16.5 23.5L24 11.5L31.5 23.5L39.2 18.5L37.5 30.5Z" fill="#FFE666"/>
    <rect x="7.5" y="32.5" width="33" height="8.5" rx="3.2" fill="#FFF078" stroke="#14192B" stroke-width="3.4"/>
    <circle cx="24" cy="23.5" r="4.8" fill="#FF385C" stroke="#14192B" stroke-width="2.4"/>
    <circle cx="22.6" cy="22" r="1.5" fill="#FFFFFF"/>
  </svg>`,

  platinum: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="24,3.5 43,15.5 37.5,37.5 24,44.5 10.5,37.5 5,15.5" fill="#0EC9B8" stroke="#14192B" stroke-width="3.6" stroke-linejoin="round"/>
    <polygon points="24,8.5 37,17.2 32.5,33.5 24,38.8 15.5,33.5 11,17.2" fill="#7EFFF2" stroke="#14192B" stroke-width="2.6" stroke-linejoin="round"/>
    <polygon points="24,8.5 11,17.2 15.5,33.5 24,38.8" fill="#C9FFFA" opacity="0.65"/>
    <polygon points="24,15 30,24 24,33 18,24" fill="#FFFFFF" stroke="#14192B" stroke-width="2.4" stroke-linejoin="round"/>
  </svg>`,

  diamond: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="13.5,6.5 34.5,6.5 44.5,19 24,43.5 3.5,19" fill="#1E8EFF" stroke="#14192B" stroke-width="3.6" stroke-linejoin="round"/>
    <polygon points="13.5,6.5 34.5,6.5 30.5,19 17.5,19" fill="#C4E9FF" stroke="#14192B" stroke-width="2.4" stroke-linejoin="round"/>
    <polygon points="17.5,19 30.5,19 24,43.5" fill="#63C2FF" stroke="#14192B" stroke-width="2.4" stroke-linejoin="round"/>
    <polygon points="13.5,6.5 17.5,19 3.5,19" fill="#8CD4FF"/>
    <circle cx="24" cy="13" r="2.8" fill="#FFFFFF"/>
  </svg>`,

  legendary: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 2.8C29.5 11.8 40 14 40 26.2C40 36.5 32.5 43.5 24 44.5C15.5 43.5 8 36.5 8 26.2C8 15.8 16.8 11.8 20 7.6C21 11.8 23 11.8 24 2.8Z" fill="#FF3D14" stroke="#14192B" stroke-width="3.6" stroke-linejoin="round"/>
    <path d="M24 13.5C28.5 19.5 33.8 22 33.8 29C33.8 35.2 29.4 39.2 24 39.2C18.6 39.2 14.2 35.2 14.2 29C14.2 23.5 18.8 20.5 24 13.5Z" fill="#FFCE2E" stroke="#14192B" stroke-width="2.6" stroke-linejoin="round"/>
    <polygon points="24,21.5 26.6,27.5 32.5,28.4 28.2,32.6 29.2,38.2 24,35.4 18.8,38.2 19.8,32.6 15.5,28.4 21.4,27.5" fill="#FFFFFF" stroke="#14192B" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,

  master: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="24,2.5 30.2,13.5 43.5,11.5 37.5,24 43.5,36.5 30.2,34.5 24,45.5 17.8,34.5 4.5,36.5 10.5,24 4.5,11.5 17.8,13.5" fill="#A82BFF" stroke="#14192B" stroke-width="3.4" stroke-linejoin="round"/>
    <polygon points="24,7.5 28.5,16 38,14.8 33.5,24 38,33.2 28.5,32 24,40.5 19.5,32 10,33.2 14.5,24 10,14.8 19.5,16" fill="#E08CFF" opacity="0.5"/>
    <circle cx="24" cy="24" r="11.4" fill="#FFE047" stroke="#14192B" stroke-width="3"/>
    <polygon points="24,14.8 26.9,20.8 33.4,21.7 28.7,26.2 29.8,32.4 24,29.3 18.2,32.4 19.3,26.2 14.6,21.7 21.1,20.8" fill="#FFFFFF" stroke="#14192B" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,
};

export function renderRankEmblem(tierId = 'bronze', size = 32) {
  const raw = RANK_EMBLEMS[tierId] || RANK_EMBLEMS.bronze;
  return `<span class="toon-icon-wrap rank-emblem-wrap" style="width:${size}px;height:${size}px">${raw}</span>`;
}
