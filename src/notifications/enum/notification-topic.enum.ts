// Broadcast channels a client may be subscribed to on the push provider.
// `sendToTopic` fans a message out to everyone subscribed to a topic without
// the server needing to know their individual device tokens.
export enum NotificationTopic {
  general = 'general',
  announcements = 'announcements',
  promotions = 'promotions',
}
