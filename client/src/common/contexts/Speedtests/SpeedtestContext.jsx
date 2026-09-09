import React, {useState, createContext, useEffect, useCallback, useRef} from "react";
import {jsonRequest} from "@/common/utils/RequestUtil";

export const SpeedtestContext = createContext({});

export const SpeedtestProvider = (props) => {
    const [speedtests, setSpeedtests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastId, setLastId] = useState(null);
    const loadingRef = useRef(false);
    const lastLoadTimeRef = useRef(0);

    const loadInitialTests = useCallback(async () => {
        if (loadingRef.current) return;

        loadingRef.current = true;
        setLoading(true);
        try {
            const tests = await jsonRequest("/speedtests?limit=30");
            setSpeedtests(tests);
            if (tests.length > 0) {
                setLastId(tests[tests.length - 1].id);
                setHasMore(tests.length === 30);
            } else {
                setLastId(null);
                setHasMore(false);
            }
        } catch (error) {
            console.error("Failed to load initial tests:", error);
            setSpeedtests([]);
            setLastId(null);
            setHasMore(false);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, []);

    const loadMoreTests = useCallback(async () => {
        const now = Date.now();
        if (loadingRef.current || !hasMore || !lastId || (now - lastLoadTimeRef.current) < 500) return;

        lastLoadTimeRef.current = now;
        loadingRef.current = true;
        setLoading(true);
        try {
            const newTests = await jsonRequest(`/speedtests?limit=30&afterId=${lastId}`);
            if (newTests.length > 0) {
                setSpeedtests(prev => {
                    const existingIds = new Set(prev.map(test => test.id));
                    const uniqueNewTests = newTests.filter(test => !existingIds.has(test.id));

                    if (uniqueNewTests.length > 0) {
                        setLastId(newTests[newTests.length - 1].id);
                        return [...prev, ...uniqueNewTests];
                    }
                    return prev;
                });
                setHasMore(newTests.length === 30);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Failed to load more tests:", error);
            setHasMore(false);
            setTimeout(() => {
                if (lastId) setHasMore(true);
            }, 3000);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [hasMore, lastId]);

    const refreshTests = useCallback(async () => {
        const latestId = speedtests.length > 0 ? speedtests[0].id : null;

        try {
            const newTests = await jsonRequest("/speedtests?limit=30");

            if (newTests.length > 0) {
                if (latestId) {
                    const newerTests = newTests.filter(test => test.id > latestId);
                    if (newerTests.length > 0) setSpeedtests(prev => [...newerTests, ...prev]);
                } else {
                    setSpeedtests(newTests);
                    if (newTests.length > 0) setLastId(newTests[newTests.length - 1].id);
                    setHasMore(newTests.length === 30);
                }
            }
        } catch (error) {
            console.error("Failed to refresh tests:", error);
        }
    }, [speedtests]);

    const deleteTest = useCallback((id) => {
        setSpeedtests(prev => prev.filter(test => test.id !== id));
        if (speedtests.length === 1) {
            setLastId(null);
            setHasMore(false);
        } else if (speedtests[speedtests.length - 1].id === id) {
            setLastId(speedtests[speedtests.length - 2].id);
        }
    });

    const updateTests = useCallback(() => {
        refreshTests();
    }, [refreshTests]);

    useEffect(() => {
        loadInitialTests();
    }, [loadInitialTests]);

    useEffect(() => {
        const interval = setInterval(() => {
            refreshTests();
        }, 5000);

        return () => clearInterval(interval);
    }, [refreshTests]);

    return (
        <SpeedtestContext.Provider value={{speedtests, updateTests, deleteTest, loadMoreTests, loading, hasMore}}>
            {props.children}
        </SpeedtestContext.Provider>
    )
}