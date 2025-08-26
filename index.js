/*
import * as React from 'react'
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SHA256 } from 'crypto-js';
*/

const URL = "https://script.google.com/macros/s/AKfycbyr2Rl3KQlEfGwQhoM2hj6xYqRLqyFKPdYdhNm52lyuYW08lkUyxyT0L4kAAqv3SIuqQg/exec"
var last_submit = localStorage.getItem("last_submit")
if ((last_submit==null || last_submit==undefined)) {
    // 처음 접속
    last_submit = 0
    localStorage.setItem("last_submit", 0);
}

function setLastSubmit(ls, salt) {
    last_submit = ls;
    localStorage.setItem("last_submit", ls);
    storage.hash = SHA256(salt + last_submit).toString();
}

function StudyCafeReservation() {
    const getSeoulNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
    };

    const [now, setNow] = useState(getSeoulNow());
    const closingTime = useMemo(() => {
    const d = getSeoulNow();
    d.setHours(18, 20, 0, 0); // 18:20 고정
    return d;
    }, [now]);
    const msUntilClose = Math.max(0, closingTime - now);

    const openingTime = useMemo(() => {
    const d = getSeoulNow();
    d.setHours(8, 20, 0, 0); // 13:20 고정
    if (msUntilClose===0) d.setDate(d.getDate() + 1);
    return d;
    }, [now]);
    const msUntilOpen = Math.max(0, openingTime - now);

    const isOpen = (msUntilOpen === 0 && msUntilClose !== 0);
    //const isOpen = true;

    const [salt, setSalt] = useState(null);
    useEffect(() => {
    let s = "ecyc salt "+Math.random().toString().substring(2,7);
    setSalt(s);
    setLastSubmit(last_submit, s);
    }, [])

    const checkIntegrity = () => {
    if (salt==null) return;
    last_submit = localStorage.getItem("last_submit")
    if ((last_submit==null || last_submit==undefined)) {
        console.log("데이터 변조가 있었습니다. 15분 동안 예약할 수 없습니다.");
        setLastSubmit(Date.now().toString(), salt);
    }
    if (salt==null && storage.hash==null) return;
    if (storage.hash==null) {
        console.log("데이터 변조가 있었습니다. 15분 동안 예약할 수 없습니다.");
        setLastSubmit(Date.now().toString(), salt);
    }
    if (storage.hash!=SHA256(salt + last_submit).toString()) {
        console.log("데이터 변조가 있었습니다. 15분 동안 예약할 수 없습니다.");
        setLastSubmit(Date.now().toString(), salt);
    }
    }

    useEffect(checkIntegrity)

    useEffect(() => {
    const t = setInterval(() => setNow(getSeoulNow()), 1000);
    return () => clearInterval(t);
    }, []);

    const [listLoading, setListLoading] = useState(true);
    const [list, setList] = useState([]);

    const [fetching, setFetching] = useState(true);
    const [lastReload, setLastReload] = useState(new Date(0));
    let aborts = new Set();
    useEffect(() => {
    if (!fetching) return;
    if (getSeoulNow()-lastReload < 2000) return;
    setLastReload(getSeoulNow());
    const ctrl = new AbortController();
    const signal = ctrl.signal;
    aborts.add(ctrl);
    fetch(URL, {
        signal,
        method: "GET",
        redirect: "follow"
    })
    .then(response => response.text())
    .catch(error => {
        if (signal.aborted) {
        console.log("aborted");
        return;
        }
        console.error('Error:', error);
        return [];
    })
    .then((data) => {
        setList(JSON.parse(data).map((e) => ({studentId:e[0], name:e[1], date: new Date(e[3]), sub: e[4]})));
        setListLoading(false);
        console.log("init start")
    })
    .finally(() => aborts.delete(ctrl));
    })

    const [studentId, setStudentId] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [ok, setOk] = useState("");
    const [progress, setProgress] = useState("");

    const capacity = 14;
    const remaining = Math.max(0, capacity - list.length);

    const handleReserve = (e) => {
    e.preventDefault();
    if (!fetching) return;
    setError("");
    setOk("");
    setProgress("");
    
    if (storage.sub == null) {
        setError("우상단의 버튼을 눌러 구글 계정으로 로그인하세요.");
        return;
    }

    checkIntegrity();
    let time_since = Date.now() - last_submit
    if (time_since < 900000) {
        setError("예약한 뒤 15분 내에는 다시 예약할 수 없어요.");
        return;
    }

    if (!isOpen) {
        setError("예약은 매일 13:20에서 18:20까지에만 할 수 있어요.");
        return;
    }
    if (!studentId.trim() || !name.trim()) {
        setError("학번과 이름을 모두 입력해 주세요.");
        return;
    }
    if (!/^\d{2,}$/.test(studentId.trim())) {
        setError("학번을 올바르게 입력해 주세요.");
        return;
    }

    setProgress("예약 요청을 보냈습니다. 잠시 기다려 주세요...")
    
    const data = {
        studentId: studentId.trim(),
        name: name.trim(),
        sub: storage.sub,
        authdate: storage.authdate,
        auth: storage.auth
    };
    
    setFetching(false);
    last_submit = Date.now().toString();
    setLastSubmit(last_submit, salt);
    for (e of aborts) {
        e.abort();
    }
    fetch(URL, {
        method: "POST",
        redirect: "follow",
        headers: {
        "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(data),
    }).then(response => response.text())
    .then(result => {
        setProgress("");
        setFetching(true);
        if (result.startsWith("fail")) {
        let msg = result.substring(6).split("\n");
        setError(msg[0]); // fail: [실패사유]
        setLastSubmit(0, salt);
        if (msg.length < 2) return;
        setList(JSON.parse(msg[1]).map((e) => ({studentId:e[0], name:e[1], date: new Date(e[3]), sub: e[4]})));
        return;
        }
        setList(JSON.parse(result).map((e) => ({studentId:e[0], name:e[1], date: new Date(e[3]), sub: e[4]})));
        setStudentId("");
        setName("");
        setOk("예약이 완료되었어요. 오늘 야간 자율학습 시간에 이용하세요.");
    })
    .catch(error => console.error('Error:', error));
    }

    const handleDeletion = (key) => {
    if (!fetching) return;
    if (storage.sub == null) {
        setError("구글 계정으로 로그인 한 뒤 다시 시도해 주세요.");
        return;
    }
    
    setError("");
    setOk("");
    setProgress("취소 요청을 보냈습니다. 잠시 기다려 주세요...");
    
    const data = {
        studentId: "DELETE",
        key: key,
        sub: storage.sub,
        authdate: storage.authdate,
        auth: storage.auth
    };
    
    setFetching(false);
    for (e of aborts) {
        e.abort();
    }
    fetch(URL, {
        method: "POST",
        redirect: "follow",
        headers: {
        "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(data),
    }).then(response => response.text())
    .then(result => {
        setFetching(true);
        setProgress("");
        if (result.startsWith("fail")) {
        let msg = result.substring(6).split("\n");
        setError(msg[0]); // fail: [실패사유]
        if (msg.length < 2) return;
        setList(JSON.parse(msg[1]).map((e) => ({studentId:e[0], name:e[1], date: new Date(e[3])})));
        return;
        }
        setList(JSON.parse(result).map((e) => ({studentId:e[0], name:e[1], date: new Date(e[3])})));
        setOk("예약을 취소했어요.");
        setLastSubmit(0, salt);
    })
    .catch(error => console.error('Error:', error));
    }

    const maskId = (id) => (id.length <= 2 ? id : `${id.slice(0, 2)}••••`);
    const timeLeft = () => {
    const ms = msUntilOpen;
    const s = Math.floor(ms / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
    };
    const timeLeftClosing = () => {
    const ms = msUntilClose;
    const s = Math.floor(ms / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
    };

    const container = "max-w-3xl mx-auto px-6";
    const glass = "backdrop-blur-xl bg-white/70 dark:bg-[#232323]/70 border border-neutral-200 dark:border-neutral-700 rounded-[42px] shadow-lg";
    const btnBase = "rounded-[16px] px-5 py-3 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
    const btnPrimary = btnBase + " bg-black text-white dark:bg-neutral-50 dark:text-neutral-950 hover:bg-black/90 hover:dark:bg-neutral-50/90 active:scale-[0.99]";
    const inputBase = "w-full rounded-[16px] border border-neutral-300 dark:border-neutral-600 px-4 py-3 focus:outline-none focus:ring-4 focus:ring-neutral-200 transition bg-white dark:bg-neutral-950";

    return (
    <div>
        <section className={container + " mt-16 pt-14 pb-10"}>
        <div className="flex flex-col items-start gap-6">
            <h1 className="text-4xl md:text-6xl leading-tight tracking-tight font-semibold">
            충곽 <span className="inline-block bg-black text-white dark:bg-neutral-50 dark:text-neutral-950 px-2 rounded-xl">스터디 카페</span>
            <br/> 1층 언어실습실에서 만나요.
            </h1>
            <p className="text-neutral-600 dark:text-neutral-300 text-lg md:text-xl font-semibold">
            매일 13:20~18:20 선착순 <strong>{capacity}명</strong> 예약 · 당일 야간 자율학습시간 이용
            </p>
        </div>
        </section>
        
        <section className={container + " pb-16"}>
        <div className={glass + " p-6 md:p-8"}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
                <div className="text-sm text-neutral-500 dark:text-neutral-300">오늘 날짜</div>
                <div className="text-2xl font-medium">{formatYMD(now)}</div>
            </div>
            <div className="text-right">
                {isOpen ? (
                listLoading ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-orange-600/20 bg-orange-50 dark:bg-orange-950 pl-1 pr-2 py-1 text-orange-700 dark:text-orange-400 tabular-nums">
                    <div className="w-6 h-6 rounded-full circle circle-orange" style={{background: `conic-gradient(var(--color-fg) 0deg ${(1-msUntilClose/(5*3600000))*360}deg, var(--color-bg) ${(1-msUntilClose/(5*3600000))*360}deg 360deg)`}}/>
                    가져오는 중 / {timeLeftClosing()}
                    </div>
                ) : (
                    remaining==0 ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-red-600/20 bg-red-50 dark:bg-red-950 pl-1 pr-2 py-1 text-red-700 dark:text-red-400 tabular-nums">
                        <div className="w-6 h-6 rounded-full circle circle-red" style={{backgroundColor: "var(--color-fg)"}}/>
                        예약 조기 마감
                    </div>
                    ) : (
                    <div className="inline-flex items-center gap-1 rounded-full border border-green-600/20 bg-green-50 dark:bg-green-950 pl-1 pr-2 py-1 text-green-700 dark:text-green-400 tabular-nums">
                        <div className="w-6 h-6 rounded-full circle circle-green" style={{background: `conic-gradient(var(--color-fg) 0deg ${(1-msUntilClose/(5*3600000))*360}deg, var(--color-bg) ${(1-msUntilClose/(5*3600000))*360}deg 360deg)`}}/>
                        예약 마감까지 {timeLeftClosing()}
                    </div>
                    )
                )
                ) : (
                <div className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-50 dark:bg-[#232323] pl-1 pr-2 py-1 text-neutral-700 dark:text-neutral-400 tabular-nums">
                    <div className="w-6 h-6 rounded-full circle circle-gray" style={{backgroundColor: "var(--color-fg)"}}/>
                    {`오픈까지 ${timeLeft()}`}
                </div>
                )}
            </div>
            </div>

            <div className="mt-4 w-full">
            <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-300 mb-1">
                <span>예약 현황</span>
                {listLoading ? (
                    <span className="font-semibold">.../{capacity}</span>
                ) : (
                    remaining==0 ? (
                    <span className="font-semibold">{capacity}/{capacity}(마감)</span>
                    ) : (
                    <span className="font-semibold">{capacity-remaining}/{capacity}</span>
                    )
                )}
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
                {isOpen ? (
                listLoading ? (
                    <div
                    className="absolute inset-y-0 left-0 rounded-full bg-orange-200 dark:bg-orange-500/25 transition-[width]"
                    style={{ width: `100%` }}
                    />
                ) : (
                    remaining==0 ? (
                    <div
                        className="absolute inset-y-0 left-0 rounded-full bg-red-500 dark:bg-red-400 transition-[width,background-color] duration-500"
                        style={{ width: `100%` }}
                    />
                    ) : (
                    <div
                        className="absolute inset-y-0 left-0 rounded-full bg-green-500 dark:bg-green-400 transition-[width,background-color] duration-500"
                        style={{ width: `${Math.min(100, Math.round((1 - remaining / capacity) * 100))}%` }}
                    />
                    )
                )
                ) : (
                listLoading ? (
                    <div
                    className="absolute inset-y-0 left-0 rounded-full bg-neutral-300 dark:bg-neutral-600 transition-[width] duration-500"
                    style={{ width: `100%` }}
                    />
                ) : (
                    <div
                    className="absolute inset-y-0 left-0 rounded-full bg-neutral-500 dark:bg-neutral-400 transition-[width,background-color] duration-500"
                    style={{ width: `${Math.min(100, Math.round((1 - remaining / capacity) * 100))}%` }}
                    />
                )
                )}
            </div>
            </div>

            <form onSubmit={handleReserve} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
                className={inputBase}
                type="text"
                inputMode="numeric"
                placeholder="학번"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={!isOpen || list.length >= capacity}
                aria-label="학번"
            />
            <input
                className={inputBase}
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isOpen || list.length >= capacity}
                aria-label="이름"
            />
            <button
                className={btnPrimary}
                type="submit"
                disabled={!isOpen || list.length >= capacity}
            >
                예약하기
            </button>
            </form>

            {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-950 px-4 py-3 text-red-700 dark:text-red-400 text-sm">{error}</div>
            )}
            {ok && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 px-4 py-3 text-emerald-700 dark:text-emerald-400 text-sm">{ok}</div>
            )}
            {progress && (
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-950 px-4 py-3 text-orange-700 dark:text-orange-400 text-sm">{progress}</div>
            )}
            
            <div className="mt-10">
            <div className="flex items-end justify-between">
                <h2 className="text-xl font-semibold tracking-tight">오늘의 예약 명단</h2>
                <div className="text-xs text-neutral-500 dark:text-neutral-300">선착순 정렬 (최대 {capacity}명)</div>
            </div>
            {listLoading ? (
                <ol className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden">
                    <li className="p-4 text-neutral-500 dark:text-neutral-300 text-sm">로딩중</li>
                </ol>
            ) : (
                <ol className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden">
                    {list.length === 0 && (
                    <li className="p-4 text-neutral-500 dark:text-neutral-300 text-sm">아직 예약이 없어요. 오픈은 13:20이에요.</li>
                    )}
                    {list.toReversed().map((r, idx) => (
                    <li key={r.studentId} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600 text-sm">
                            {list.length - idx}
                        </span>
                        <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-300">학번 {maskId(r.studentId.toString())}</div>
                        </div>
                        </div>
                        <div className="flex gap-2">
                        {
                            (isOpen && r.sub!=null && r.sub==storage.sub) && (
                            <button className="inline-block text-xs text-red-500 dark:text-red-600" onClick={() => handleDeletion(r.studentId)}>
                                취소
                            </button>
                            )
                        }
                        <div className="inline-block text-xs text-neutral-500 dark:text-neutral-300">
                            {new Date(r.date).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        </div>
                    </li>
                    ))}
                </ol>
            )}
            </div>
        </div>
        </section>

        <footer className="border-t border-neutral-200/60 dark:border-neutral-700/60">
        <div className={container + " py-10 text-sm text-neutral-500 flex flex-col md:flex-row gap-4 md:items-center md:justify-between"}>
            <div>© {now.getFullYear()} 충곽 스터디 카페 예약 <span className="font-br-cobane">BY QPI</span></div>
            <div className="opacity-80">매일 13:20~18:20 오픈 · 당일 야간 자율학습 시간 이용 가능</div>
        </div>
        </footer>
    </div>
    );
}
        
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<StudyCafeReservation />);