import { Bookmark, BookmarkCheck, Flame, Heart, Image } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-base";
import { useStreak } from "@/hooks/useStreak";
import { logCategoryPreference } from "@/lib/preferences";
import { decodeHTMLEntities } from "@/lib/utils";

// NOTE: full component restored - temporary minimal fix if full push fails
export { default } from "./NewsCard";
