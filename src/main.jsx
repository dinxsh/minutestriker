import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  BadgeDollarSign,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Coins,
  Flame,
  Gauge,
  Lock,
  Medal,
  Palette,
  Settings,
  ShieldCheck,
  Trophy,
  UserCircle,
  UserPlus,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  createBentoWalletLink,
  estimateBentoBet,
  exchangeBentoWalletCode,
  extractEstimate,
  fetchBentoMarkets,
  fetchBentoPortfolio,
  fetchBentoReadiness,
  fetchLeaderboardUsers,
  humanToWei,
  initialBentoReadiness,
  loginBentoWallet,
  normalizeExternalLogin,
  normalizeBentoLogin,
  placeBentoBet,
  saveLeaderboardUser,
  shortAddress,
  weiToHuman,
} from "./bento";
import "./styles.css";

const formatMoney = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00");
const DEFAULT_PROFILES = [];
const PROFILE_STORAGE_KEY = "haramball-world-cup-profiles";
const ACTIVE_PROFILE_STORAGE_KEY = "haramball-active-profile-id";
const ACTIVITY_STORAGE_KEY = "haramball-activity-feed";
const THEME_STORAGE_KEY = "haramball-theme";
const TOURNAMENT_STORAGE_KEY = "haramball-tournaments";
const CURRENT_TOURNAMENT_STORAGE_KEY = "haramball-current-tournament-id";
const USE_TEMPORARY_BETS = true;
const ROUND_SECONDS = 5;
const LOCKOUT_SECONDS = Math.ceil(ROUND_SECONDS * 0.15);
const TEMPORARY_FALLBACK_FIXTURE = { home: "Argentina", away: "Brazil", label: "Argentina vs Brazil" };
const TEMPORARY_BETS = [
  {
    id: "temp-counter-attack-goal",
    duelId: "temp-counter-attack-goal",
    title: "Will this counter attack turn into a goal?",
    category: "Live match",
    status: "temporary",
    optionA: "YES",
    optionB: "NO",
  },
  {
    id: "temp-freekick-target",
    duelId: "temp-freekick-target",
    title: "Will the freekick hit the target?",
    category: "Live match",
    status: "temporary",
    optionA: "YES",
    optionB: "NO",
  },
  {
    id: "temp-counter-attack-deep",
    duelId: "temp-counter-attack-deep",
    title: "Will this counter attack at least enter the opponent dee?",
    category: "Live match",
    status: "temporary",
    optionA: "YES",
    optionB: "NO",
  },
  {
    id: "temp-penalty-goal",
    duelId: "temp-penalty-goal",
    title: "Will this penalty be a goal?",
    category: "Live match",
    status: "temporary",
    optionA: "YES",
    optionB: "NO",
  },
];
const TOKEN_OPTIONS = [
  { symbol: "USDC", name: "USD Coin", network: "Base", icon: "$" },
  { symbol: "USDT", name: "Tether USD", network: "Ethereum", icon: "T" },
  { symbol: "ETH", name: "Ether", network: "Ethereum", icon: "E" },
  { symbol: "SOL", name: "Solana", network: "Solana", icon: "S" },
  { symbol: "BTC", name: "Bitcoin", network: "Bitcoin", icon: "B" },
];
const TEAM_FLAGS = {
  Argentina: "\u{1F1E6}\u{1F1F7}",
  Brazil: "\u{1F1E7}\u{1F1F7}",
  England: "\u{1F3F4}",
  France: "\u{1F1EB}\u{1F1F7}",
  Germany: "\u{1F1E9}\u{1F1EA}",
  Japan: "\u{1F1EF}\u{1F1F5}",
  Morocco: "\u{1F1F2}\u{1F1E6}",
  USA: "\u{1F1FA}\u{1F1F8}",
};
const DEFAULT_TOURNAMENTS = [
  { id: "premier-weekend", name: "Premier Weekend", host: "Haramball", visibility: "public", players: 128, inviteCode: "PREM15" },
  { id: "underdog-cup", name: "Underdog Cup", host: "Community", visibility: "public", players: 64, inviteCode: "DOGS" },
  { id: "friends-table", name: "Friends Table", host: "Invite only", visibility: "private", players: 12, inviteCode: "MATES" },
];

function App() {
  const [readiness, setReadiness] = useState(initialBentoReadiness);
  const [markets, setMarkets] = useState([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [marketIndex, setMarketIndex] = useState(0);
  const [wallet, setWallet] = useState("");
  const [token, setToken] = useState("");
  const [authMode, setAuthMode] = useState("");
  const [managedAccount, setManagedAccount] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [walletOptions, setWalletOptions] = useState([]);
  const [walletOptionsLoading, setWalletOptionsLoading] = useState(true);
  const [stake, setStake] = useState("1");
  const [stakeCurrency, setStakeCurrency] = useState("USDC");
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("USDC");
  const [tokenSearch, setTokenSearch] = useState("");
  const [pick, setPick] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [profiles, setProfiles] = useState(loadProfiles);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || "");
  const [profileDraft, setProfileDraft] = useState({ name: "", username: "", team: "USA", style: "Striker", twitter: "", discord: "" });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [profileModalOpen, setProfileModalOpen] = useState(() => !localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY));
  const [tournamentModalOpen, setTournamentModalOpen] = useState(false);
  const [tournamentView, setTournamentView] = useState("public");
  const [tournaments, setTournaments] = useState(loadTournaments);
  const [currentTournamentId, setCurrentTournamentId] = useState(() => localStorage.getItem(CURRENT_TOURNAMENT_STORAGE_KEY) || DEFAULT_TOURNAMENTS[0].id);
  const [tournamentDraft, setTournamentDraft] = useState({ name: "", visibility: "public", inviteCode: "" });
  const [inviteCode, setInviteCode] = useState("");
  const [profileMode, setProfileMode] = useState("onboarding");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || "classic");
  const [toast, setToast] = useState("");
  const [feed, setFeed] = useState(loadActivityFeed);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => Math.floor(Date.now() / 1000) % ROUND_SECONDS);
  const [settlement, setSettlement] = useState({
    tone: "idle",
    icon: "?",
    title: "Ready for your pick",
    body: "Pick a side to preview the ticket before locking it.",
    payout: "--",
    receipt: null,
  });
  const reconcileTimer = useRef(null);

  const market = markets[marketIndex] || null;
  const amountWei = useMemo(() => humanToWei(stake), [stake]);
  const authed = Boolean(token && authMode === "wallet");
  const optionLabel = pick === 0 ? market?.optionA : pick === 1 ? market?.optionB : "";
  const secondsRemaining = Math.max(0, ROUND_SECONDS - elapsedSeconds);
  const lockoutActive = secondsRemaining <= LOCKOUT_SECONDS;
  const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / ROUND_SECONDS) * 100));
  const marketTitle = market?.title || (readiness.configured ? "No match markets returned" : "Market board needs setup");
  const marketBody = market
    ? "Preview your ticket, then lock it in."
    : readiness.configured
      ? "Try again when the live market board is available."
      : "Add the server market key, then restart the app to load live match markets.";
  const fixture = useMemo(() => fixtureFromMarket(market), [market]);
  const leagueName = leagueFromMarket(market);
  const currentTournament = tournaments.find((item) => item.id === currentTournamentId) || tournaments[0] || DEFAULT_TOURNAMENTS[0];
  const selectedToken = TOKEN_OPTIONS.find((item) => item.symbol === stakeCurrency) || TOKEN_OPTIONS[0];
  const leaderboard = useMemo(
    () => dedupeProfiles(profiles).sort((a, b) => b.wins - a.wins || a.losses - b.losses).slice(0, 5),
    [profiles],
  );
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const profileRouteUsername = usernameFromProfilePath();
  const routeProfile = profileRouteUsername
    ? dedupeProfiles(profiles).find((profile) => usernameFrom(profile.username || profile.name) === profileRouteUsername)
    : null;
  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 1800);
  };
  const notifications = useMemo(
    () => feed.map((item, index) => ({
      id: `${item.minute}-${item.label}-${index}`,
      ...item,
    })),
    [feed],
  );
  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;
  const markNotificationsRead = () => {
    setReadNotificationIds(notifications.map((item) => item.id));
  };

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(feed));
  }, [feed]);

  useEffect(() => {
    localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(tournaments));
  }, [tournaments]);

  useEffect(() => {
    localStorage.setItem(CURRENT_TOURNAMENT_STORAGE_KEY, currentTournamentId);
  }, [currentTournamentId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      setElapsedSeconds(nowSeconds % ROUND_SECONDS);
      if (USE_TEMPORARY_BETS) {
        setMarketIndex(Math.floor(nowSeconds / ROUND_SECONDS) % TEMPORARY_BETS.length);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchLeaderboardUsers()
      .then((users) => {
        if (alive && users.length) setProfiles(users.map(normalizeProfile));
      })
      .catch(() => {
        if (alive) showToast("Using local leaderboard cache");
      })
      .finally(() => {
        if (alive) setProfilesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    discoverEvmWalletOptions()
      .then((options) => {
        if (alive) setWalletOptions(options);
      })
      .finally(() => {
        if (alive) setWalletOptionsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchBentoReadiness().then((next) => {
      if (alive) setReadiness(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (USE_TEMPORARY_BETS) {
      setMarkets(withTemporaryFixture(TEMPORARY_BETS, TEMPORARY_FALLBACK_FIXTURE));
      setMarketError("");
      setMarketsLoading(false);
      setReadiness((value) => ({ ...value, configured: true, missing: [] }));
      fetchBentoMarkets({ page: 1, limit: 20 })
        .then((nextMarkets) => {
          if (!alive) return;
          const fixtureMarket = nextMarkets.find((item) => item.duelId) || nextMarkets[0];
          setMarkets(withTemporaryFixture(TEMPORARY_BETS, fixtureFromMarket(fixtureMarket)));
        })
        .catch(() => {
          if (alive) setMarkets(withTemporaryFixture(TEMPORARY_BETS, TEMPORARY_FALLBACK_FIXTURE));
        });
      return () => {
        alive = false;
      };
    }

    if (!readiness.configured) {
      setMarkets([]);
      setMarketError("");
      setMarketsLoading(false);
      return () => {
        alive = false;
      };
    }

    setMarketsLoading(true);
    fetchBentoMarkets({ page: 1, limit: 20 })
      .then((nextMarkets) => {
        if (!alive) return;
        setMarkets(nextMarkets.filter((item) => item.duelId));
        setMarketError("");
      })
      .catch((error) => {
        if (!alive) return;
        setMarketError(error.message);
        setMarkets([]);
      })
      .finally(() => {
        if (alive) setMarketsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [readiness.configured]);

  useEffect(() => {
    setPick(null);
    setEstimate(null);
      setSettlement({
        tone: "idle",
        icon: "?",
        title: market ? "Ready for your pick" : "Choose a match market",
        body: market ? "Select an outcome to preview the ticket." : "Live match markets will appear here when the board loads.",
        payout: "--",
        receipt: null,
      });
  }, [market?.duelId]);

  useEffect(() => {
    if (!token) return;
    refreshPortfolio();
    return () => window.clearTimeout(reconcileTimer.current);
  }, [token]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;

    setLinkLoading(true);
    exchangeBentoWalletCode({ code })
      .then((payload) => {
        const login = normalizeExternalLogin(payload);
        if (!login.token) throw new Error("Wallet link did not return a session");
        setAuthMode("link");
        setWallet(login.address || "");
        setManagedAccount(login.managedAccount || "");
        setFeed((items) => [{ minute: timeStamp(), label: "Wallet linked. Browser wallet still required for tickets." }, ...items].slice(0, 6));
        showToast("Wallet linked for profile");
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      })
      .catch((error) => showToast(error.message))
      .finally(() => setLinkLoading(false));
  }, []);

  const connectWallet = async (walletOption) => {
    const ethereum = walletOption?.provider || window.ethereum;
    if (!ethereum?.request) {
      showToast("No browser wallet found. Use wallet link.");
      return;
    }

    setWalletLoading(true);
    try {
      const [address] = await ethereum.request({ method: "eth_requestAccounts" });
      const timestamp = String(Date.now());
      const message = `Bento.fun Login\nTimestamp: ${timestamp}\nWallet: ${address}`;
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });
      const login = normalizeBentoLogin(
        await loginBentoWallet({
          address,
          signature,
          timestamp,
          username: activeProfile?.username || activeProfile?.name || `haramball-${address.slice(2, 8)}`,
        }),
      );

      if (!login.token) throw new Error("Market login did not return a session");
      setWallet(address);
      setToken(login.token);
      setAuthMode("wallet");
      setManagedAccount(login.managedAccount || "");
      setProfiles((items) => attachWalletToProfiles(items, activeProfileId, address, login.managedAccount));
      setFeed((items) => [{ minute: timeStamp(), label: `${walletOption?.name || "Wallet"} connected for matchday markets` }, ...items].slice(0, 6));
      showToast(`${walletOption?.name || "Wallet"} connected`);
    } catch (error) {
      showToast(walletErrorMessage(error));
    } finally {
      setWalletLoading(false);
    }
  };

  const connectWithWalletLink = async () => {
    setLinkLoading(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const state = activeProfile?.id || `haramball-${Date.now()}`;
      const payload = await createBentoWalletLink({ returnUrl, state });
      const url = payload.url || payload.data?.url;
      if (!url) throw new Error("Wallet link did not return a URL");
      window.location.href = url;
    } catch (error) {
      showToast(error.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const quotePick = async (optionIndex) => {
    if (!market) return;
    if (lockoutActive) {
      showToast("Market is locked for the final 15%");
      return;
    }
    setPick(optionIndex);
    setEstimate(null);

    if (!authed) {
      openProfileModal(activeProfile ? "settings" : "onboarding");
      showToast(authMode === "link" ? "Use browser wallet to trade" : "Connect wallet before previewing");
      return;
    }
    if (Number(stake) <= 0) {
      showToast("Enter a stake above 0");
      return;
    }

    setEstimateLoading(true);
    try {
      const nextEstimate = extractEstimate(
        await estimateBentoBet({
          token,
          duelId: market.duelId,
          optionIndex,
          amountWei,
          slippageBps: 100,
        }),
      );
      setEstimate(nextEstimate);
      setSettlement({
        tone: optionIndex === 0 ? "yes" : "no",
        icon: optionIndex === 0 ? "Y" : "N",
        title: `${optionIndex === 0 ? market.optionA : market.optionB} preview ready`,
        body: nextEstimate.sharesOut
          ? `${formatMoney(stake)} ${stakeCurrency} for estimated ${weiToHuman(nextEstimate.sharesOut)} shares.`
          : `${formatMoney(stake)} ${stakeCurrency} ticket preview is ready.`,
        payout: "Preview",
        receipt: null,
      });
    } catch (error) {
      showToast(error.message);
    } finally {
      setEstimateLoading(false);
    }
  };

  const submitBet = async () => {
    if (!market || pick === null || !estimate) {
      showToast("Preview an outcome first");
      return;
    }
    if (lockoutActive) {
      showToast("Market is locked for the final 15%");
      return;
    }

    setPlacing(true);
    const idempotencyKey = crypto.randomUUID();
    const quote = estimate.raw?.estimate || estimate.raw?.data?.estimate || estimate.raw?.data || estimate.raw;
    const bet = {
      estimate: quote,
      duelId: market.duelId,
      duelType: "prediction",
      bet: optionLabel,
      optionIndex: pick,
      betAmount: amountWei,
      betAmountUsdc: amountWei,
      slippageBps: 100,
      collateralMode: market.raw?.collateralMode || market.raw?.collateral_mode || undefined,
    };

    try {
      await placeBentoBet({ token, idempotencyKey, bet });
      const receipt = {
        duelId: market.duelId,
        market: market.title,
        outcome: optionLabel,
        stake: `${formatMoney(stake)} ${stakeCurrency}`,
        shares: estimate.sharesOut ? weiToHuman(estimate.sharesOut) : "pending",
        quoteId: estimate.quoteId || "sdk",
        idempotencyKey,
        account: managedAccount || "Market account",
      };
      setSettlement({
        tone: "won",
        icon: <ShieldCheck size={18} />,
        title: "Ticket locked",
        body: "Your position is live. We are refreshing your account until the market catches up.",
        payout: "Pending",
        receipt,
      });
      setFeed((items) => [{ minute: timeStamp(), label: `${optionLabel} ticket locked for ${fixture.label}` }, ...items].slice(0, 6));
      showToast("Ticket locked");
      reconcilePortfolio(0);
    } catch (error) {
      showToast(error.message);
    } finally {
      setPlacing(false);
    }
  };

  const refreshPortfolio = async () => {
    setPortfolioLoading(true);
    try {
      const nextPortfolio = await fetchBentoPortfolio({ token, account: managedAccount });
      setPortfolio(nextPortfolio);
      return nextPortfolio;
    } catch {
      return null;
    } finally {
      setPortfolioLoading(false);
    }
  };

  const reconcilePortfolio = (attempt) => {
    window.clearTimeout(reconcileTimer.current);
    reconcileTimer.current = window.setTimeout(async () => {
      const nextPortfolio = await refreshPortfolio();
      if (nextPortfolio) {
        setSettlement((value) => ({
          ...value,
          title: attempt > 0 ? "Account refreshed" : value.title,
          body: "Your account has refreshed. Final result updates when the market settles.",
        }));
      }
      if (attempt < 4) reconcilePortfolio(attempt + 1);
    }, attempt === 0 ? 1200 : 3500);
  };

  const openProfileModal = (mode) => {
    setProfileMode(mode);
    if (activeProfile) {
      setProfileDraft({
        name: activeProfile.name,
        username: activeProfile.username || "",
        team: activeProfile.team,
        style: activeProfile.style,
        twitter: activeProfile.twitter || "",
        discord: activeProfile.discord || "",
      });
    }
    setProfileModalOpen(true);
    setProfileMenuOpen(false);
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const cleanName = profileDraft.name.trim();
    const cleanUsername = usernameFrom(profileDraft.username || cleanName);
    if (!cleanName) {
      showToast("Add a profile name");
      return;
    }

    const existing = profileMode !== "onboarding" && activeProfile;
    const nextProfile = normalizeProfile(existing
      ? { ...activeProfile, name: cleanName, username: cleanUsername, team: profileDraft.team, style: profileDraft.style, twitter: profileDraft.twitter, discord: profileDraft.discord, walletId: wallet || activeProfile.walletId, managedAccount: managedAccount || activeProfile.managedAccount }
      : {
          id: profileIdFrom({ username: cleanUsername, walletId: wallet, name: cleanName }),
          name: cleanName,
          username: cleanUsername,
          team: profileDraft.team,
          style: profileDraft.style,
          twitter: profileDraft.twitter,
          discord: profileDraft.discord,
          walletId: wallet,
          managedAccount,
          wins: 0,
          losses: 0,
        });

    setProfiles((items) => dedupeProfiles(existing ? items.map((item) => item.id === activeProfile.id ? nextProfile : item) : [...items, nextProfile]));
    saveLeaderboardUser(nextProfile)
      .then((saved) => setProfiles((items) => dedupeProfiles(items.map((item) => item.id === saved.id ? normalizeProfile(saved) : item))))
      .catch(() => showToast("Profile saved locally only"));
    setActiveProfileId(nextProfile.id);
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, nextProfile.id);
    setProfileDraft({ name: "", username: "", team: profileDraft.team, style: profileDraft.style, twitter: "", discord: "" });
    setProfileModalOpen(false);
    if (!existing && profileMode === "onboarding") {
      setTournamentModalOpen(true);
      setTournamentView("public");
    }
    setFeed((items) => [{ minute: timeStamp(), label: existing ? `${cleanName} updated their fan profile` : `${cleanName} joined the leaderboard` }, ...items].slice(0, 6));
    showToast(existing ? "Profile updated" : "Profile created");
  };

  const joinTournament = (tournament) => {
    setCurrentTournamentId(tournament.id);
    showToast(`Joined ${tournament.name}`);
    setTournamentModalOpen(false);
  };

  const joinInviteTournament = () => {
    const code = inviteCode.trim().toUpperCase();
    const tournament = tournaments.find((item) => item.inviteCode.toUpperCase() === code);
    if (!tournament) {
      showToast("Invite code not found");
      return;
    }
    joinTournament(tournament);
  };

  const createTournament = (event) => {
    event.preventDefault();
    const cleanName = tournamentDraft.name.trim();
    if (!cleanName) {
      showToast("Add a tournament name");
      return;
    }
    const nextTournament = {
      id: `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: cleanName,
      host: activeProfile?.username ? `@${activeProfile.username}` : activeProfile?.name || "You",
      visibility: tournamentDraft.visibility,
      players: 1,
      inviteCode: (tournamentDraft.inviteCode || cleanName.slice(0, 5)).replace(/[^a-z0-9]/gi, "").toUpperCase() || "PLAY",
    };
    setTournaments((items) => [nextTournament, ...items]);
    setCurrentTournamentId(nextTournament.id);
    setTournamentDraft({ name: "", visibility: "public", inviteCode: "" });
    setTournamentModalOpen(false);
    showToast("Tournament created");
  };

  const openTokenModal = () => {
    setTokenDraft(stakeCurrency);
    setTokenSearch("");
    setTokenModalOpen(true);
  };

  const confirmToken = () => {
    setStakeCurrency(tokenDraft);
    setTokenModalOpen(false);
  };

  const statusCards = [
    {
      icon: <Clock3 size={18} />,
      label: "Match Board",
      value: marketsLoading ? "Loading" : `${markets.length} markets`,
      body: "Match markets load before you connect a wallet.",
    },
    {
      icon: <Gauge size={18} />,
      label: "Ticket",
      value: estimate ? "Ready" : "Required",
      body: "Preview shares and price before locking a pick.",
    },
    {
      icon: <ShieldCheck size={18} />,
      label: "Result",
      value: "Tracked",
      body: "Your account refreshes after every locked ticket.",
    },
  ];

  if (profileRouteUsername) {
    return (
      <main className="app-shell profile-route-shell">
        <section className="phone-frame" aria-label={`haramball.xyz profile ${profileRouteUsername}`}>
          <div className="phone-screen">
            <header className="profile-route-hero">
              <a className="back-link" href="/">haramball.xyz</a>
              <a className="back-arrow-button" href="/" aria-label="Back to markets">
                <ArrowLeft size={20} />
              </a>
              <h1>@{profileRouteUsername}</h1>
              <p>Profile, interactions, and market activity.</p>
            </header>
            <section className="play-stack">
              <ProfileActivityCard activeProfile={routeProfile} fallbackToFirst={false} feed={feed} loading={profilesLoading} profiles={leaderboard} />
              <LeaderboardCard loading={profilesLoading} profiles={leaderboard} />
            </section>
          </div>
        </section>
        <aside className="desktop-panel">
          <LeaderboardCard loading={profilesLoading} profiles={leaderboard} wide />
          <ProfileActivityCard activeProfile={routeProfile} fallbackToFirst={false} feed={feed} loading={profilesLoading} profiles={leaderboard} wide />
        </aside>
        <div className={toast ? "toast show" : "toast"}>{toast}</div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="haramball.xyz markets app">
        <div className="phone-screen">
          <header className="match-hero">
            <nav className="topbar" aria-label="Match controls">
              <div className="brand">
                <span className="brand-wordmark">haramball.xyz</span>
              </div>
              <div className="topbar-actions">
                <div className="notification-menu-wrap">
                  <button className="notification-button" onClick={() => setNotificationsOpen((value) => !value)} type="button" aria-label="Notifications">
                    <Bell size={18} />
                    {unreadCount ? <span>{unreadCount}</span> : null}
                  </button>
                  {notificationsOpen ? (
                    <div className="notification-dropdown">
                      <div className="notification-head">
                        <strong>Notifications</strong>
                        <button onClick={markNotificationsRead} type="button">Mark read</button>
                      </div>
                      {notifications.length ? notifications.map((item) => (
                        <div className={readNotificationIds.includes(item.id) ? "notification-row read" : "notification-row"} key={item.id}>
                          <strong>{item.minute}</strong>
                          <span>{item.label}</span>
                        </div>
                      )) : (
                        <div className="notification-empty">No notifications yet</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="profile-menu-wrap">
                <button className="profile-icon-button" onClick={() => activeProfile ? setProfileMenuOpen((value) => !value) : openProfileModal("onboarding")} type="button">
                  {activeProfile ? teamFlag(activeProfile.team) : <UserCircle size={20} />}
                </button>
                {profileMenuOpen ? (
                  <div className="profile-dropdown">
                    <div className="profile-dropdown-head">
                      <strong>{activeProfile.name}</strong>
                      <span>{activeProfile.team} - {activeProfile.style}</span>
                    </div>
                    <button onClick={() => openProfileModal("edit")} type="button">
                      <UserCircle size={15} />
                      Profile
                    </button>
                    <button onClick={() => openProfileModal("settings")} type="button">
                      <Settings size={15} />
                      Settings
                    </button>
                    <button onClick={() => setTheme((value) => value === "classic" ? "night" : "classic")} type="button">
                      <Palette size={15} />
                      Theme: {theme === "classic" ? "Classic" : "Night"}
                    </button>
                  </div>
                ) : null}
                </div>
              </div>
            </nav>

            <div className="scoreline">
              {marketsLoading ? (
                <HeroSkeleton />
              ) : (
                <>
                  <Team name={fixture.home} />
                  <div className="score">v/s</div>
                  <Team name={fixture.away} align="right" />
                </>
              )}
            </div>
            <div className="market-context" aria-label="Market context">
              <b>{leagueName} - {currentTournament.name}</b>
            </div>

          </header>

          <section className="play-stack">
            {marketError ? <p className="state-note">{marketError}</p> : null}

            <article className="cycle-card is-action">
              <div className="timer-block">
                <div className="timer-label">
                  <span>{lockoutActive ? "Market locked" : "Lock closes in"}</span>
                  <b>{secondsRemaining}s</b>
                </div>
                <div className="progress-track">
                  <span className={lockoutActive ? "is-locked" : ""} style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              {marketsLoading ? <MarketQuestionSkeleton /> : (
                <div className="question-block">
                  <h1>{marketTitle}</h1>
                  <p>{marketBody}</p>
                </div>
              )}

              <div className="stake-block">
                <div className="stake-label">
                  <span>Stake</span>
                  <strong>{formatMoney(stake)} {stakeCurrency}</strong>
                </div>
                <label className="stake-input-wrap">
                  <Coins size={16} />
                  <input
                    disabled={!market || placing}
                    inputMode="decimal"
                    min="0.01"
                    onChange={(event) => setStake(event.target.value)}
                    placeholder="Type any amount"
                    step="0.01"
                    type="number"
                    value={stake}
                  />
                  <button className="token-select-button" disabled={!market || placing} onClick={openTokenModal} type="button">
                    <span>{selectedToken.symbol}</span>
                    <ChevronDown size={14} />
                  </button>
                </label>
                <div className="chip-grid">
                  {["1", "2.5", "5", "10"].map((amount) => (
                    <button
                      className={stake === amount ? "chip active" : "chip"}
                      disabled={!market || placing}
                      key={amount}
                      onClick={() => setStake(amount)}
                      type="button"
                    >
                      <Coins size={15} />
                      {amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="decision-row">
                <button className="decision yes" disabled={!market || estimateLoading || placing || lockoutActive} onClick={() => quotePick(0)} type="button">
                  <Check size={22} />
                  {marketsLoading ? <SkeletonLine width="58px" /> : market?.optionA || "YES"}
                </button>
                <button className="decision no" disabled={!market || estimateLoading || placing || lockoutActive} onClick={() => quotePick(1)} type="button">
                  <X size={22} />
                  {marketsLoading ? <SkeletonLine width="52px" /> : market?.optionB || "NO"}
                </button>
              </div>

              <div className="market-nav">
                <button className="activate-button" disabled={!estimate || placing || lockoutActive} onClick={submitBet} type="button">
                  <Lock size={17} />
                  {placing ? <SkeletonLine width="104px" /> : "Lock Ticket"}
                </button>
              </div>
            </article>

            <SettlementCard
              estimate={estimate}
              estimateLoading={estimateLoading}
              market={market}
              pick={pick}
              placing={placing}
              settlement={settlement}
              stake={stake}
              stakeCurrency={stakeCurrency}
            />
            <FeedCard feed={feed} loading={portfolioLoading} portfolio={portfolio} />
            <LeaderboardCard loading={profilesLoading} profiles={leaderboard} />
          </section>
        </div>
      </section>

      <aside className="desktop-panel">
        <section className="intro-panel">
          <div className="eyebrow">
            <Flame size={16} />
            Match market rush
          </div>
          <h2>Pick the moment before the stadium does.</h2>
          <p>
            haramball.xyz is a fast market board for quick YES/NO calls, clean tickets, and live account refreshes.
          </p>
        </section>

        <section className="status-grid">
          {statusCards.map((card) => (
            <article className="status-card" key={card.label}>
              <span className="status-icon">{card.icon}</span>
              <small>{card.label}</small>
              <strong>{marketsLoading && card.label === "Match Board" ? <SkeletonLine width="78px" /> : card.value}</strong>
              <p>{card.body}</p>
            </article>
          ))}
        </section>

        <section className="architecture-panel">
          <h2>Matchday Flow</h2>
          <div className="rail-item">
            <BadgeDollarSign size={18} />
            <span>Live market board loads before wallet connection</span>
          </div>
          <div className="rail-item">
            <Zap size={18} />
            <span>One wallet signature opens the market account</span>
          </div>
          <div className="rail-item">
            <Trophy size={18} />
            <span>Preview, lock, and track every ticket clearly</span>
          </div>
        </section>

        <LeaderboardCard loading={profilesLoading} profiles={leaderboard} wide />
        <ProfileActivityCard activeProfile={activeProfile} feed={feed} loading={profilesLoading} profiles={leaderboard} wide />
      </aside>

      {profileModalOpen ? (
        <OnboardingModal
          activeProfile={activeProfile}
          authMode={authMode}
          connectWallet={connectWallet}
          connectWithWalletLink={connectWithWalletLink}
          draft={profileDraft}
          linkLoading={linkLoading}
          mode={profileMode}
          setDraft={setProfileDraft}
          onClose={() => activeProfile && setProfileModalOpen(false)}
          onSubmit={saveProfile}
          wallet={wallet}
          walletLoading={walletLoading}
          walletOptions={walletOptions}
          walletOptionsLoading={walletOptionsLoading}
        />
      ) : null}

      {tokenModalOpen ? (
        <TokenModal
          onCancel={() => setTokenModalOpen(false)}
          onConfirm={confirmToken}
          search={tokenSearch}
          selected={tokenDraft}
          setSearch={setTokenSearch}
          setSelected={setTokenDraft}
        />
      ) : null}

      {tournamentModalOpen ? (
        <TournamentModal
          createTournament={createTournament}
          draft={tournamentDraft}
          inviteCode={inviteCode}
          joinInviteTournament={joinInviteTournament}
          joinTournament={joinTournament}
          onClose={() => setTournamentModalOpen(false)}
          setDraft={setTournamentDraft}
          setInviteCode={setInviteCode}
          setView={setTournamentView}
          tournaments={tournaments}
          view={tournamentView}
        />
      ) : null}

      <div className={toast ? "toast show" : "toast"}>{toast}</div>
    </main>
  );
}

function LeaderboardCard({ loading = false, profiles, wide = false }) {
  return (
    <article className={`leaderboard-card ${wide ? "wide" : ""}`}>
      <h2>
        <Trophy size={17} />
        Top 5
      </h2>
      <div className="leaderboard-list">
        {loading ? (
          <LeaderboardSkeleton />
        ) : profiles.length === 0 ? (
          <div className="leaderboard-empty">No live players yet</div>
        ) : profiles.map((profile, index) => (
          <a className="leaderboard-row" href={`/@${profile.username || usernameFrom(profile.name)}`} key={profile.id}>
            <span className={`rank rank-${index + 1}`}>{index < 3 ? <Medal size={15} /> : index + 1}</span>
            <div>
              <strong>{profile.name}</strong>
              <small>@{profile.username || usernameFrom(profile.name)} - {profile.team} - {profile.wins}W / {profile.losses}L</small>
            </div>
            <b>{profile.wins}-{profile.losses}</b>
          </a>
        ))}
      </div>
    </article>
  );
}

function ProfileActivityCard({ activeProfile, fallbackToFirst = true, feed, loading = false, profiles, wide = false }) {
  const profile = activeProfile || (fallbackToFirst ? profiles[0] : null) || null;
  const wins = profile?.wins || 0;
  const losses = profile?.losses || 0;
  const total = Math.max(1, wins + losses);
  const winRate = Math.round((wins / total) * 100);
  const activity = buildActivityCells(feed);
  const logItems = feed.slice(0, 5);

  return (
    <article className={`profile-activity-card ${wide ? "wide" : ""}`}>
      <h2>
        <UserCircle size={17} />
        Profile
      </h2>
      {loading ? (
        <ProfileActivitySkeleton />
      ) : profile ? (
        <>
          <div className="player-profile-panel">
            <span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span>
            <div className="profile-copy">
              <strong>{profile.name}</strong>
              <small>@{profile.username || usernameFrom(profile.name)} - {profile.team} - {profile.style}</small>
            </div>
            <div className="record-stack" aria-label={`${wins} wins and ${losses} losses`}>
              <span className="record-pill wins">{wins}W</span>
              <span className="record-pill losses">{losses}L</span>
            </div>
          </div>
          <div className="profile-metrics">
            <span>
              <small>Win rate</small>
              <b>{winRate}%</b>
            </span>
            <span>
              <small>Wins</small>
              <b>{wins}</b>
            </span>
            <span>
              <small>Activity</small>
              <b>{feed.length}</b>
            </span>
          </div>
          <div className="activity-grid" aria-label="Interaction activity">
            {activity.map((cell, index) => (
              <span className={`activity-cell level-${cell}`} key={`activity-${index}`} title={`${cell} interactions`} />
            ))}
          </div>
          <div className="activity-log">
            {logItems.length ? logItems.map((item, index) => (
              <div className="activity-log-row" key={`${item.minute}-${item.label}-${index}`}>
                <strong>{item.minute}</strong>
                <span>{item.label}</span>
              </div>
            )) : (
              <div className="activity-log-row">
                <strong>{timeStamp()}</strong>
                <span>No activity yet</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="leaderboard-empty">Create a profile to track activity</div>
      )}
    </article>
  );
}

function OnboardingModal({
  activeProfile,
  authMode,
  connectWallet,
  connectWithWalletLink,
  draft,
  linkLoading,
  mode,
  onClose,
  onSubmit,
  setDraft,
  wallet,
  walletLoading,
  walletOptions,
  walletOptionsLoading,
}) {
  const isOnboarding = mode === "onboarding";
  const isSettings = mode === "settings";
  const title = isOnboarding ? "Join Matchday" : isSettings ? "Account Settings" : "Edit Fan Profile";
  const body = isOnboarding
    ? "Create a fan profile first. Connect your wallet now or later when you are ready to lock a ticket."
    : isSettings
      ? "Manage your matchday identity and wallet connection."
      : "Update how you show up on the leaderboard.";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-hero">
          <div>
            <span className="category">Match Markets</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
          <button className="profile-icon-button modal-close" disabled={isOnboarding && !activeProfile} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {isSettings ? (
          <div className="settings-grid">
            <div className="wallet-selector" aria-label="Choose wallet">
              <strong>Choose wallet</strong>
              {walletOptionsLoading ? (
                <WalletSkeleton />
              ) : walletOptions.length ? (
                walletOptions.map((option) => (
                  <button
                    className="wallet-option available"
                    disabled={walletLoading}
                    key={option.id}
                    onClick={() => connectWallet(option)}
                    type="button"
                  >
                    <span>{option.name}</span>
                    <small>{walletLoading ? <SkeletonLine width="62%" small /> : option.hint}</small>
                  </button>
                ))
              ) : (
                <div className="wallet-empty">
                  <strong>No browser wallet found</strong>
                  <span>Open wallet link or install MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.</span>
                </div>
              )}
            </div>
            <button className="wallet-button alt" onClick={connectWithWalletLink} disabled={linkLoading} type="button">
              <Wallet size={17} />
              {linkLoading ? <SkeletonLine width="94px" /> : "Open wallet link"}
            </button>
            <div className="settings-note">
              <strong>{activeProfile?.name || "No profile yet"}</strong>
              <span>
                {wallet
                  ? `${authMode === "wallet" ? "Trading wallet" : "Linked wallet"} ${shortAddress(wallet)}`
                  : "Use wallet link if no extension appears in this browser."}
              </span>
            </div>
          </div>
        ) : null}

        {!isSettings ? (
          <ProfileBuilder
            activeProfile={activeProfile}
            draft={draft}
            setDraft={setDraft}
            onSubmit={onSubmit}
            submitLabel={isOnboarding ? "Enter Matchday" : "Save Profile"}
          />
        ) : (
          <ProfileBuilder
            activeProfile={activeProfile}
            draft={draft}
            setDraft={setDraft}
            onSubmit={onSubmit}
            submitLabel="Save Profile"
          />
        )}
      </section>
    </div>
  );
}

function ProfileBuilder({ draft, setDraft, onSubmit, activeProfile, submitLabel = "Create Profile", wide = false }) {
  return (
    <article className={`profile-card ${wide ? "wide" : ""}`}>
      {activeProfile ? (
        <div className="profile-preview">
          <span>{teamFlag(activeProfile.team)}</span>
          <div>
            <strong>{activeProfile.name}</strong>
            <small>{activeProfile.team} - {activeProfile.style} - {activeProfile.wins} wins</small>
          </div>
        </div>
      ) : null}
      <form className="profile-form" onSubmit={onSubmit}>
        <label>
          <span>Display name</span>
          <input
            maxLength={18}
            onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
            placeholder="Your matchday name"
            value={draft.name}
          />
        </label>
        <label>
          <span>Username</span>
          <input
            maxLength={18}
            onChange={(event) => setDraft((value) => ({ ...value, username: event.target.value }))}
            placeholder="username"
            value={draft.username}
          />
        </label>
        <label>
          <span>Team</span>
          <select onChange={(event) => setDraft((value) => ({ ...value, team: event.target.value }))} value={draft.team}>
            {["USA", "Argentina", "Brazil", "England", "France", "Germany", "Japan", "Morocco"].map((team) => (
              <option key={team}>{team}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Style</span>
          <select onChange={(event) => setDraft((value) => ({ ...value, style: event.target.value }))} value={draft.style}>
            {["Striker", "Midfield", "Defense", "Chaos", "Underdog"].map((style) => (
              <option key={style}>{style}</option>
            ))}
          </select>
        </label>
        <fieldset className="socials-fieldset">
          <legend>Optional socials</legend>
          <label>
            <span>X / Twitter</span>
            <input
              maxLength={32}
              onChange={(event) => setDraft((value) => ({ ...value, twitter: event.target.value }))}
              placeholder="@handle"
              value={draft.twitter}
            />
          </label>
          <label>
            <span>Instagram</span>
            <input
              maxLength={32}
              onChange={(event) => setDraft((value) => ({ ...value, discord: event.target.value }))}
              placeholder="@handle"
              value={draft.discord}
            />
          </label>
        </fieldset>
        <button className="activate-button" type="submit">
          <UserPlus size={17} />
          {submitLabel}
        </button>
      </form>
    </article>
  );
}

function Team({ flag, name, sublabel, stat, align = "left" }) {
  return (
    <div className={`team ${align === "right" ? "right" : ""}`}>
      {flag ? <span className="team-flag" aria-hidden="true">{flag}</span> : null}
      <strong>{name}</strong>
      {sublabel ? <span>{sublabel} <b>{stat}</b></span> : null}
    </div>
  );
}

function SettlementCard({ estimate, estimateLoading, market, pick, placing, settlement, stake, stakeCurrency }) {
  if (estimateLoading || placing) {
    return (
      <article className="settlement-card">
        <h2>Your Ticket</h2>
        <div className="result">
          <SkeletonBox className="result-icon" />
          <div>
            <SkeletonLine width="68%" />
            <SkeletonLine width="92%" small />
          </div>
          <SkeletonLine width="54px" />
        </div>
      </article>
    );
  }

  const selectedOutcome = pick === 0 ? market?.optionA : pick === 1 ? market?.optionB : "";
  const stakeAmount = Number.isFinite(Number(stake)) ? Number(stake) : 0;
  const estimateAmount = Number(weiToHuman(estimate?.sharesOut || "0"));
  const winAmount = estimate?.sharesOut && Number.isFinite(estimateAmount) && estimateAmount > 0 ? estimateAmount : stakeAmount;
  const hasPreview = Boolean(selectedOutcome);
  const iconClass = hasPreview ? (pick === 0 ? "yes" : "no") : settlement.tone;

  return (
    <article className="settlement-card">
      <h2>Your Ticket</h2>
      {hasPreview ? (
        <div className="ticket-preview-card">
          <span className={`result-icon ${iconClass}`}>{selectedOutcome.slice(0, 1)}</span>
          <div className="ticket-main">
            <strong>{selectedOutcome}</strong>
            <small>{market?.title || "Match market"}</small>
          </div>
          <div className="ticket-stats">
            <span className="ticket-stat upside-win">
              <small>Win</small>
              <b>+{formatMoney(winAmount)} {stakeCurrency}</b>
            </span>
            <span className="ticket-stat stake-risk">
              <small>Lose</small>
              <b>-{formatMoney(stakeAmount)} {stakeCurrency}</b>
            </span>
          </div>
        </div>
      ) : (
        <div className="result">
          <span className={`result-icon ${settlement.tone}`}>{settlement.icon}</span>
          <div>
            <strong>{settlement.title}</strong>
            <p>{settlement.body}</p>
          </div>
          <b>{settlement.payout}</b>
        </div>
      )}
      {settlement.receipt ? (
        <details className="receipt-proof">
          <summary>
            <ShieldCheck size={16} />
            <span>{settlement.receipt.outcome} on market {settlement.receipt.duelId}</span>
            <ChevronDown size={16} />
          </summary>
          <div className="receipt-grid" aria-label="Match ticket receipt">
            {Object.entries(settlement.receipt).map(([key, value]) => (
              <div className={key === "market" ? "receipt-rule" : ""} key={key}>
                <span>{receiptLabel(key)}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function FeedCard({ feed, loading, portfolio }) {
  const activity = portfolio ? [{ minute: timeStamp(), label: "Account refreshed" }, ...feed] : feed;
  return (
    <article className="feed-card">
      <h2>Live Feed</h2>
      <div className="feed-list">
        {loading ? (
          <FeedSkeleton />
        ) : activity.length === 0 ? (
          <div className="feed-item empty">
            <strong>{timeStamp()}</strong>
            <span>Waiting for live match events</span>
          </div>
        ) : (
          activity.map((item, index) => (
            <div className="feed-item" key={`${item.minute}-${item.label}-${index}`}>
              <strong>{item.minute}</strong>
              <span>{item.label}</span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function HeroSkeleton() {
  return (
    <>
      <div className="team">
        <SkeletonLine width="82%" dark tall />
      </div>
      <div className="score">
        <SkeletonLine width="78px" />
      </div>
      <div className="team right">
        <SkeletonLine width="82%" dark tall />
      </div>
    </>
  );
}

function MarketQuestionSkeleton() {
  return (
    <div className="question-block">
      <SkeletonLine width="94%" tall />
      <SkeletonLine width="74%" tall />
      <SkeletonLine width="82%" small />
    </div>
  );
}

function LeaderboardSkeleton() {
  return Array.from({ length: 3 }, (_, index) => (
    <div className="leaderboard-row" key={`leaderboard-skeleton-${index}`}>
      <SkeletonBox className="rank" />
      <div>
        <SkeletonLine width="72%" />
        <SkeletonLine width="54%" small />
      </div>
      <SkeletonLine width="42px" />
    </div>
  ));
}

function FeedSkeleton() {
  return Array.from({ length: 3 }, (_, index) => (
    <div className="feed-item" key={`feed-skeleton-${index}`}>
      <SkeletonLine width="48px" />
      <SkeletonLine width={index === 1 ? "82%" : "64%"} />
    </div>
  ));
}

function ProfileActivitySkeleton() {
  return (
    <>
      <div className="player-profile-panel">
        <SkeletonBox className="profile-avatar" />
        <div>
          <SkeletonLine width="96px" />
          <SkeletonLine width="148px" small />
        </div>
        <SkeletonLine width="56px" />
      </div>
      <div className="activity-grid">
        {Array.from({ length: 28 }, (_, index) => <span className="activity-cell level-0" key={`profile-skeleton-${index}`} />)}
      </div>
    </>
  );
}

function WalletSkeleton() {
  return (
    <>
      {[0, 1].map((index) => (
        <div className="wallet-option" key={`wallet-skeleton-${index}`}>
          <SkeletonLine width="74%" />
          <SkeletonLine width="48%" small />
        </div>
      ))}
    </>
  );
}

function TokenModal({ onCancel, onConfirm, search, selected, setSearch, setSelected }) {
  const options = TOKEN_OPTIONS.filter((token) => {
    const haystack = `${token.symbol} ${token.name} ${token.network}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const current = TOKEN_OPTIONS.find((token) => token.symbol === selected) || TOKEN_OPTIONS[0];

  return (
    <div className="modal-backdrop token-modal-backdrop" role="presentation">
      <section className="token-modal" role="dialog" aria-modal="true" aria-label="Select token and network">
        <div className="token-modal-head">
          <div>
            <h2>Select token</h2>
            <p>Choose network and currency for this ticket.</p>
          </div>
          <button className="profile-icon-button modal-close" onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>
        <label className="token-search">
          <span>Search</span>
          <input autoFocus onChange={(event) => setSearch(event.target.value)} placeholder="Search token or network" value={search} />
        </label>
        <div className="token-list">
          {options.map((token) => (
            <button className={token.symbol === selected ? "token-row active" : "token-row"} key={`${token.network}-${token.symbol}`} onClick={() => setSelected(token.symbol)} type="button">
              <span className="token-icon">{token.icon}</span>
              <span>
                <strong>{token.symbol}</strong>
                <small>{token.name}</small>
              </span>
              <b>{token.network}</b>
            </button>
          ))}
        </div>
        <div className="token-modal-actions">
          <button className="chip" onClick={onCancel} type="button">Cancel</button>
          <button className="activate-button" onClick={onConfirm} type="button">
            Confirm {current.symbol}
          </button>
        </div>
      </section>
    </div>
  );
}

function TournamentModal({
  createTournament,
  draft,
  inviteCode,
  joinInviteTournament,
  joinTournament,
  onClose,
  setDraft,
  setInviteCode,
  setView,
  tournaments,
  view,
}) {
  const visibleTournaments = view === "invite"
    ? tournaments.filter((item) => item.visibility === "private")
    : tournaments.filter((item) => item.visibility === "public");

  return (
    <div className="modal-backdrop tournament-modal-backdrop" role="presentation">
      <section className="tournament-modal" role="dialog" aria-modal="true" aria-label="Choose a tournament">
        <div className="tournament-hero">
          <div>
            <span className="category">Next up</span>
            <h2>Join a tournament</h2>
            <p>Create your own room or jump into a public board.</p>
          </div>
          <button className="profile-icon-button modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="tournament-tabs" role="tablist" aria-label="Tournament mode">
          {[
            ["public", "Public"],
            ["invite", "Invite"],
            ["create", "Create"],
          ].map(([id, label]) => (
            <button className={view === id ? "active" : ""} key={id} onClick={() => setView(id)} type="button">
              {label}
            </button>
          ))}
        </div>

        {view === "create" ? (
          <form className="tournament-create" onSubmit={createTournament}>
            <label>
              <span>Tournament name</span>
              <input onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Friday five-a-side" value={draft.name} />
            </label>
            <label>
              <span>Visibility</span>
              <select onChange={(event) => setDraft((value) => ({ ...value, visibility: event.target.value }))} value={draft.visibility}>
                <option value="public">Public</option>
                <option value="private">Invite code</option>
              </select>
            </label>
            <label>
              <span>Invite code</span>
              <input onChange={(event) => setDraft((value) => ({ ...value, inviteCode: event.target.value }))} placeholder="Optional" value={draft.inviteCode} />
            </label>
            <button className="activate-button" type="submit">
              <Trophy size={17} />
              Create Tournament
            </button>
          </form>
        ) : (
          <>
            {view === "invite" ? (
              <div className="invite-code-row">
                <input onChange={(event) => setInviteCode(event.target.value)} placeholder="Enter invite code" value={inviteCode} />
                <button className="activate-button" onClick={joinInviteTournament} type="button">Join</button>
              </div>
            ) : null}
            <div className="tournament-list">
              {visibleTournaments.map((tournament) => (
                <article className="tournament-row" key={tournament.id}>
                  <span className="rank"><Trophy size={15} /></span>
                  <div>
                    <strong>{tournament.name}</strong>
                    <small>{tournament.host} - {tournament.players} players - {tournament.visibility}</small>
                  </div>
                  <button onClick={() => joinTournament(tournament)} type="button">Join</button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function SkeletonBox({ className = "" }) {
  return <span className={`skeleton-box ${className}`} aria-hidden="true" />;
}

function SkeletonLine({ dark = false, small = false, tall = false, width = "100%" }) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton-line ${dark ? "dark" : ""} ${small ? "small" : ""} ${tall ? "tall" : ""}`}
      style={{ width }}
    />
  );
}

async function discoverEvmWalletOptions() {
  const browserWindow = typeof window === "undefined" ? {} : window;
  const announced = [];

  const onProvider = (event) => {
    if (event?.detail?.provider) announced.push(event.detail);
  };

  if (browserWindow.addEventListener && browserWindow.dispatchEvent) {
    browserWindow.addEventListener("eip6963:announceProvider", onProvider);
    browserWindow.dispatchEvent(new Event("eip6963:requestProvider"));
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    browserWindow.removeEventListener("eip6963:announceProvider", onProvider);
  }

  const ethereum = safeRead(() => browserWindow.ethereum);
  const legacyProviders = Array.isArray(ethereum?.providers) && ethereum.providers.length
    ? ethereum.providers
    : ethereum
      ? [ethereum]
      : [];
  const entries = [
    ...announced.map((detail, index) => ({
      id: detail.info?.uuid || `eip6963-${index}`,
      name: detail.info?.name || evmWalletName(detail.provider, index),
      provider: detail.provider,
      icon: detail.info?.icon,
      source: "eip6963",
    })),
    ...legacyProviders.map((provider, index) => ({
      id: `legacy-${index}-${evmWalletName(provider, index)}`,
      name: evmWalletName(provider, index),
      provider,
      source: "legacy",
    })),
  ];
  const seen = new Set();

  return entries
    .map((entry, index) => {
      const key = `${entry.name}-${providerFingerprint(entry.provider)}`;
      if (seen.has(key)) return null;
      if (entry.source === "legacy" && entries.some((item) => item.source === "eip6963" && item.name === entry.name)) return null;
      seen.add(key);
      const name = entry.name;
      return {
        id: entry.id || `${name}-${index}`,
        name,
        provider: entry.provider,
        hint: entry.source === "eip6963" ? "Detected" : entry.provider?.isConnected?.() ? "Available" : "Detected",
      };
    })
    .filter(Boolean);
}

function evmWalletName(provider, index) {
  if (provider?.isRabby) return "Rabby";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isMetaMask && provider?.isBraveWallet) return "Brave Wallet";
  if (provider?.isMetaMask) return "MetaMask";
  if (provider?.isTrust) return "Trust Wallet";
  if (provider?.isFrame) return "Frame";
  if (provider?.isOKExWallet || provider?.isOkxWallet) return "OKX Wallet";
  return index === 0 ? "Browser Wallet" : `Wallet ${index + 1}`;
}

function providerFingerprint(provider) {
  return [
    provider?.isMetaMask ? "metamask" : "",
    provider?.isRabby ? "rabby" : "",
    provider?.isCoinbaseWallet ? "coinbase" : "",
    provider?.isTrust ? "trust" : "",
    provider?.isBraveWallet ? "brave" : "",
    provider?.isFrame ? "frame" : "",
    provider?.isOKExWallet || provider?.isOkxWallet ? "okx" : "",
  ].filter(Boolean).join("-") || "generic";
}

function walletErrorMessage(error) {
  const message = String(error?.message || "").trim();
  const code = error?.code;

  if (code === 4001 || /reject|denied|cancel/i.test(message)) {
    return "Wallet connection cancelled";
  }

  return message || "Wallet connection failed";
}

function safeRead(read) {
  try {
    return read();
  } catch {
    return null;
  }
}

function receiptLabel(key) {
  return (
    {
      duelId: "market id",
      quoteId: "preview id",
      idempotencyKey: "ticket id",
    }[key] || key
  );
}

function loadProfiles() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
    return Array.isArray(stored) ? stored.map(normalizeProfile) : DEFAULT_PROFILES;
  } catch {
    return DEFAULT_PROFILES;
  }
}

function loadActivityFeed() {
  try {
    const stored = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((item) => item && item.minute && item.label).slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

function loadTournaments() {
  try {
    const stored = JSON.parse(localStorage.getItem(TOURNAMENT_STORAGE_KEY) || "null");
    return Array.isArray(stored) && stored.length ? stored : DEFAULT_TOURNAMENTS;
  } catch {
    return DEFAULT_TOURNAMENTS;
  }
}

function normalizeProfile(profile = {}) {
  const [recordWins, recordLosses] = String(profile.record || "").split("-");
  const wins = numberOr(profile.wins, recordWins, 0);
  const losses = numberOr(profile.losses, recordLosses, 0);

  return {
    id: profile.id,
    name: profile.name,
    username: usernameFrom(profile.username || profile.name),
    team: profile.team || "USA",
    style: profile.style || "Striker",
    twitter: profile.twitter || "",
    discord: profile.discord || "",
    walletId: profile.walletId || profile.wallet || profile.address || "",
    managedAccount: profile.managedAccount || "",
    wins,
    losses,
  };
}

function numberOr(value, fallbackValue, finalFallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  const fallback = Number(fallbackValue);
  return Number.isFinite(fallback) ? fallback : finalFallback;
}

function teamFlag(team) {
  return TEAM_FLAGS[team] || "\u{1F3F3}\uFE0F";
}

function timeStamp() {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function buildActivityCells(feed) {
  const cells = Array.from({ length: 28 }, () => 0);
  for (const [index] of (feed || []).entries()) {
    const cellIndex = Math.max(0, cells.length - 1 - index);
    cells[cellIndex] = Math.min(4, cells[cellIndex] + 1);
  }
  return cells;
}

function withTemporaryFixture(markets, fixture) {
  const safeFixture = fixture?.home && fixture?.away ? fixture : TEMPORARY_FALLBACK_FIXTURE;
  return markets.map((market) => ({
    ...market,
    raw: {
      ...(market.raw || {}),
      home: safeFixture.home,
      away: safeFixture.away,
      fixtureLabel: safeFixture.label,
    },
  }));
}

function fixtureFromMarket(market) {
  if (market?.raw?.home || market?.raw?.away) {
    return {
      home: market.raw.home || "Live",
      away: market.raw.away || "Market",
      label: `${market.raw.home || "Live"} vs ${market.raw.away || "Market"}`,
    };
  }

  const title = String(market?.title || "");
  const versus = title.match(/^(.+?)\s+(?:vs\.?|v\.?|beat|defeat)\s+(.+?)(?:\s+in\s+|\?|$)/i);
  if (versus) {
    return {
      home: cleanTeamName(versus[1]),
      away: cleanTeamName(versus[2]),
      label: `${cleanTeamName(versus[1])} vs ${cleanTeamName(versus[2])}`,
    };
  }

  return {
    home: market ? market.optionA || "Home" : "Team X",
    away: market ? market.optionB || "Away" : "Team Y",
    label: market ? `${market.optionA || "Team X"} vs ${market.optionB || "Team Y"}` : "Team X vs Team Y",
  };
}

function cleanTeamName(value) {
  return String(value || "")
    .replace(/^will\s+/i, "")
    .replace(/\s+their\s+next.*$/i, "")
    .trim();
}

function leagueFromMarket(market) {
  const rawLeague = market?.league || market?.raw?.league || market?.raw?.leagueName || market?.raw?.tournament || market?.raw?.competition;
  const fallback = market?.category && !/^football$/i.test(market.category) ? market.category : "League";
  return rawLeague || fallback;
}

function usernameFrom(value) {
  return String(value || "player")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 18) || "player";
}

function usernameFromProfilePath() {
  const match = window.location.pathname.match(/^\/@([a-z0-9_]+)/i);
  return match ? usernameFrom(match[1]) : "";
}

function profileIdFrom({ username, walletId, name }) {
  if (walletId) return `wallet-${walletId.toLowerCase()}`;
  return `${usernameFrom(username || name)}-${Date.now()}`;
}

function identityKey(profile) {
  if (profile.walletId) return `wallet:${String(profile.walletId).toLowerCase()}`;
  if (profile.username) return `username:${String(profile.username).toLowerCase()}`;
  return `name:${String(profile.name || "").toLowerCase()}:team:${String(profile.team || "").toLowerCase()}`;
}

function dedupeProfiles(items) {
  const byIdentity = new Map();
  for (const raw of items || []) {
    const profile = normalizeProfile(raw);
    const key = identityKey(profile);
    const existing = byIdentity.get(key);
    if (!existing || profile.wins > existing.wins || profile.losses < existing.losses) {
      byIdentity.set(key, { ...existing, ...profile });
    }
  }
  return [...byIdentity.values()];
}

function attachWalletToProfiles(items, activeProfileId, walletId, managedAccount) {
  return dedupeProfiles((items || []).map((item) => (
    item.id === activeProfileId ? { ...item, walletId, managedAccount: managedAccount || item.managedAccount } : item
  )));
}

createRoot(document.getElementById("root")).render(<App />);
