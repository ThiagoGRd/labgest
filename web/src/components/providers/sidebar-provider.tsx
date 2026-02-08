'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface SidebarContextType {
    collapsed: boolean
    setCollapsed: (collapsed: boolean) => void
    toggleCollapsed: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)

    // Opcional: Persistir estado no localStorage
    useEffect(() => {
        const saved = localStorage.getItem('sidebar-collapsed')
        if (saved) {
            setCollapsed(JSON.parse(saved))
        }
    }, [])

    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed))
    }, [collapsed])

    const toggleCollapsed = () => setCollapsed((prev) => !prev)

    return (
        <SidebarContext.Provider value={{ collapsed, setCollapsed, toggleCollapsed }}>
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
