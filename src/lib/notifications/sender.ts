import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

/**
 * Create an in-app notification for a user
 */
export async function sendNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  loanId?: string;
  actionUrl?: string;
}) {
  return prisma.notification.create({
    data: params,
  });
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

/**
 * Mark all notifications for a user as read
 */
export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}
