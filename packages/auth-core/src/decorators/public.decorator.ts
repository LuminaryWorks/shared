import { SetMetadata } from "@nestjs/common";
import { LUMINARY_PUBLIC_KEY } from "../types";

export const LuminaryPublic = () => SetMetadata(LUMINARY_PUBLIC_KEY, true);
