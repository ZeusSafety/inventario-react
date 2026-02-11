'use client';

import { useInventory } from "@/context/InventoryContext";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackContainer() {
    const { notification, hideFeedback } = useInventory();

    if (!notification) return null;

    return (
        <FeedbackModal
            isOpen={true}
            onClose={hideFeedback}
            onConfirm={notification.onConfirm}
            title={notification.title}
            message={notification.message}
            type={notification.type}
        />
    );
}
