export type Lang = "en" | "ko";

export const t = {
  appName: { en: "My Wine List", ko: "나의 와인 목록" },
  scan: { en: "Scan Label", ko: "라벨 스캔" },
  myList: { en: "My List", ko: "내 목록" },
  add: { en: "Add Wine", ko: "와인 추가" },
  save: { en: "Save", ko: "저장" },
  cancel: { en: "Cancel", ko: "취소" },
  delete: { en: "Delete", ko: "삭제" },
  price: { en: "Price (optional)", ko: "가격 (선택사항)" },
  pricePlaceholder: { en: "e.g. $45", ko: "예: $45" },
  notes: { en: "Notes", ko: "메모" },
  notesPlaceholder: { en: "Your thoughts...", ko: "한마디..." },
  wineName: { en: "Wine Name", ko: "와인 이름" },
  winery: { en: "Winery", ko: "와이너리" },
  vintage: { en: "Vintage", ko: "빈티지" },
  region: { en: "Region", ko: "지역" },
  variety: { en: "Grape Variety", ko: "품종" },
  rating: { en: "Rating", ko: "평점" },
  scanning: { en: "Analyzing label...", ko: "라벨 분석 중..." },
  scanError: { en: "Could not read label. Please try again.", ko: "라벨을 읽을 수 없습니다. 다시 시도하세요." },
  takePhoto: { en: "Take Photo", ko: "사진 찍기" },
  choosePhoto: { en: "Choose from Library", ko: "앨범에서 선택" },
  loginGoogle: { en: "Sign in with Google", ko: "Google로 로그인" },
  loginDesc: { en: "To save your wine list to Google Sheets", ko: "구글 시트에 와인 목록을 저장하려면 로그인하세요" },
  noWines: { en: "No wines yet.\nScan a label to get started!", ko: "아직 와인이 없습니다.\n라벨을 스캔해서 시작하세요!" },
  addedOn: { en: "Added", ko: "추가일" },
  saving: { en: "Saving...", ko: "저장 중..." },
  saved: { en: "Saved!", ko: "저장됨!" },
  saveError: { en: "Save failed. Check your connection.", ko: "저장 실패. 연결을 확인하세요." },
  signOut: { en: "Sign Out", ko: "로그아웃" },
  estimatedPrice: { en: "Claude's Estimated Price", ko: "Claude 추정 가격" },
  confirmDelete: { en: "Delete this wine?", ko: "이 와인을 삭제하시겠습니까?" },
  yes: { en: "Yes", ko: "예" },
  no: { en: "No", ko: "아니요" },
};

export function tr(key: keyof typeof t, lang: Lang): string {
  return t[key][lang] ?? t[key]["en"];
}
