/**
 * 프로젝트별 "데이터 뷰" 레지스트리(클라이언트 쪽). 서버 쪽 짝은
 * src/lib/project-data.ts의 PROJECT_DATA_PROVIDERS — 같은 projectId로 맞춰 등록한다.
 */
import type { ComponentType } from "react";
import { CoupangListerDataView } from "@/components/project-data-views/CoupangListerDataView";

export const PROJECT_DATA_VIEWS: Record<string, ComponentType<{ data: never }>> = {
  "coupang-lister": CoupangListerDataView as ComponentType<{ data: never }>,
};
