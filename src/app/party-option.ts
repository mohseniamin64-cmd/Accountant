export interface PartyRoleInfo {
  code: string;
  displayName: string;
  isCustomer: boolean;
  isSupplier: boolean;
}

export function partyRoleText(party: PartyRoleInfo): string {
  if (party.isCustomer && party.isSupplier) {
    return 'خریدار و تأمین‌کننده';
  }
  if (party.isCustomer) return 'خریدار';
  if (party.isSupplier) return 'تأمین‌کننده';
  return 'بدون دسته‌بندی';
}

export function partyOptionText(party: PartyRoleInfo): string {
  return party.code + ' — ' + party.displayName + ' — ' + partyRoleText(party);
}
