"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";
import { fromRow, type Row, type Student } from "@/lib/students";

// The filter/search/paging state that drives a server-side query.
export type SearchParams = {
  search: string;
  assignMode: "any" | "unassigned" | "employee";
  assigned: string | null; // employee id when assignMode = "employee"
  school: string | null;
  major: string | null;
  country: string | null;
  gender: string | null;
  tag: string | null;
  yesno: Record<string, string>; // questionId -> "true" | "false"
  multi: Record<string, string>; // questionId -> option
  cardB: string | null;
  cardD: string | null;
  admin: boolean;
  userId: string;
  page: number;
  pageSize: number;
};

function rpcArgs(p: SearchParams) {
  return {
    p_search: p.search.trim(),
    p_assigned_mode: p.assignMode,
    p_assigned: p.assignMode === "employee" ? p.assigned : null,
    p_school: p.school,
    p_major: p.major,
    p_country: p.country,
    p_gender: p.gender,
    p_tag: p.tag,
    p_yesno: p.yesno,
    p_multi: p.multi,
    p_card_b: p.cardB,
    p_card_d: p.cardD,
    p_admin: p.admin,
    p_user: p.userId,
  };
}

type SearchRow = { data: Row; is_duplicate: boolean; total: number };

// Fetches one page of students from the database (server-side filter/sort/page).
export function useStudentSearch(params: SearchParams) {
  const [rows, setRows] = useState<Student[]>([]);
  const [dupIds, setDupIds] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);
  const refetchRef = useRef<() => void>(() => {});

  const key = JSON.stringify(params);

  const refetch = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    const { data, error } = await supabase.rpc("search_students", {
      ...rpcArgs(params),
      p_limit: params.pageSize,
      p_offset: (params.page - 1) * params.pageSize,
    });
    if (my !== reqId.current) return;
    if (error) {
      setLoading(false);
      return;
    }
    const list = (data ?? []) as SearchRow[];
    setRows(list.map((r) => fromRow(r.data)));
    setDupIds(new Set(list.filter((r) => r.is_duplicate).map((r) => r.data.id)));
    setTotal(Number(list[0]?.total ?? 0));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Re-fetch whenever the query (filters/search/page) changes.
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Keep a ref to the latest refetch so the subscription (created once) always
  // reloads the current page.
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  // Live updates: reload the current page when students change (debounced so a
  // bulk change fires one reload, not one per row). Subscribes once.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`students-search-${uid()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => {
          if (t) clearTimeout(t);
          t = setTimeout(() => refetchRef.current(), 400);
        }
      )
      .subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, []);

  // All matching ids across every page (for "select all").
  const allMatchingIds = useCallback(async () => {
    const { data } = await supabase.rpc("search_student_ids", rpcArgs(params));
    return (data ?? []) as string[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { rows, dupIds, total, loading, refetch, allMatchingIds };
}

// Distinct schools + list tags for the filter dropdowns.
export function useStudentFacets(admin: boolean, userId: string) {
  const [schools, setSchools] = useState<string[]>([]);
  const [majors, setMajors] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("student_facets", {
        p_admin: admin,
        p_user: userId,
      });
      if (!active || !data) return;
      setSchools((data.schools ?? []) as string[]);
      setMajors((data.majors ?? []) as string[]);
      setCountries((data.countries ?? []) as string[]);
      setTags((data.tags ?? []) as string[]);
    })();
    return () => {
      active = false;
    };
  }, [admin, userId]);

  return { schools, majors, countries, tags };
}

// Direct DB mutations (no local list; the caller refetches the page after).
export function useStudentMutations() {
  const addStudent = useCallback(
    async (data: {
      name: string;
      phone: string;
      school?: string;
      assignedTo: string;
      gender?: string;
    }) => {
      const { error } = await supabase.from("students").insert({
        name: data.name,
        phone: data.phone,
        school: data.school ?? "",
        assigned_to: data.assignedTo || null,
        gender: data.gender ?? "N/A",
      });
      if (error) throw new Error(error.message);
    },
    []
  );

  const addStudentsBulk = useCallback(
    async (
      list: {
        name: string;
        phone: string;
        school?: string;
        assignedTo: string;
        tag?: string;
        gender?: string;
        studentNumber?: string;
        phone2?: string;
        acceptedCountry?: string;
        major?: string;
      }[]
    ) => {
      // Insert in chunks so very large uploads don't exceed request limits.
      const chunkSize = 500;
      for (let i = 0; i < list.length; i += chunkSize) {
        await supabase.from("students").insert(
          list.slice(i, i + chunkSize).map((d) => ({
            name: d.name,
            phone: d.phone,
            school: d.school ?? "",
            assigned_to: d.assignedTo || null,
            tag: d.tag ?? null,
            gender: d.gender ?? "N/A",
            student_number: d.studentNumber ?? null,
            phone2: d.phone2 ?? "",
            accepted_country: d.acceptedCountry ?? "",
            major: d.major ?? "",
          }))
        );
      }
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
  }, []);

  const removeMany = useCallback(async (ids: string[]) => {
    await supabase.from("students").delete().in("id", ids);
  }, []);

  const assignMany = useCallback(async (ids: string[], staffId: string) => {
    await supabase
      .from("students")
      .update({ assigned_to: staffId || null })
      .in("id", ids);
  }, []);

  const update = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      await supabase.from("students").update(patch).eq("id", id);
    },
    []
  );

  return {
    addStudent,
    addStudentsBulk,
    remove,
    removeMany,
    assignMany,
    update,
  };
}
