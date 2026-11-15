'use client'

import React, { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react'

interface SidebarContextType {
    isMobile: boolean
    collapsed: boolean
    setCollapsed: (collapsed: boolean) => void
    toggleCollapsed: () => void
    isOpenMobile: boolean
    setIsOpenMobile: (isOpen: boolean) => void
    toggleMobile: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)
const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed'
const SIDEBAR_CHANGE_EVENT = 'labgest-sidebar-change'
const MOBILE_QUERY = '(max-width: 767px)'
const getMobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches

function subscribeCollapsed(callback: () => void) {
    window.addEventListener('storage', callback)
    window.addEventListener(SIDEBAR_CHANGE_EVENT, callback)
    return () => {
        window.removeEventListener('storage', callback)
        window.removeEventListener(SIDEBAR_CHANGE_EVENT, callback)
    }
}

function getCollapsedSnapshot() {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, () => false)
    const [mobileOpen, setIsOpenMobile] = useState(false)
    const subscribeMobile = useCallback((callback: () => void) => {
        const media = window.matchMedia(MOBILE_QUERY)
        const onChange = () => {
            setIsOpenMobile(false)
            callback()
        }
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [])
    const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false)
    const isOpenMobile = isMobile && mobileOpen

    const setCollapsed = useCallback((value: boolean) => {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value))
        window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT))
    }, [])

    const toggleCollapsed = () => setCollapsed(!collapsed)
    const toggleMobile = () => setIsOpenMobile((prev) => !prev)

    // Close mobile sidebar on route change can be handled in component 

    return (
        <SidebarContext.Provider value={{ 
            isMobile,
            collapsed, 
            setCollapsed, 
            toggleCollapsed,
            isOpenMobile,
            setIsOpenMobile,
            toggleMobile
        }}>
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    const context = useContext(SidebarContext)
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider')
    }
    return context
}
