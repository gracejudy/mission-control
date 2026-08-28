/**
 * 프로젝트별 "데이터 뷰" 레지스트리(서버 쪽). project-scripts.ts의 실행 카드
 * 레지스트리와 짝을 이루는 개념이지만, 이쪽은 UI로 등록하는 게 아니라
 * 프로젝트마다 직접 구현하는 코드라서 JSON 파일이 아니라 함수 맵이다.
 *
 * 새 프로젝트에 데이터 뷰를 추가하려면: 이 맵에 `projectId -> () => payload`
 * 하나 추가하고, 클라이언트 쪽 짝(src/lib/project-data-views.tsx)에도
 * 같은 projectId로 렌더링 컴포넌트를 등록한다.
 */
import { getCoupangDemandData } from "./coupang-demand-data";

export interface ProjectDataPayload {
  available: boolean;
  hasContent: boolean;
  [key: string]: unknown;
}

const PROJECT_DATA_PROVIDERS: Record<string, () => ProjectDataPayload> = {
  "coupang-lister": getCoupangDemandData,
};

export function getProjectData(projectId: string): ProjectDataPayload {
  const provider = PROJECT_DATA_PROVIDERS[projectId];
  if (!provider) return { available: false, hasContent: false };
  return provider();
}
