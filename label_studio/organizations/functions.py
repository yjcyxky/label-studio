from django.db import transaction

from core.utils.common import temporary_disconnect_all_signals
from organizations.models import Organization, OrganizationMember
from projects.models import Project


def create_organization(title, created_by):
    with transaction.atomic():
        org = Organization.objects.create(title=title, created_by=created_by)
        OrganizationMember.objects.create(user=created_by, organization=org)
        return org


def destroy_organization(org):
    with temporary_disconnect_all_signals():
        Project.objects.filter(organization=org).delete()
        if hasattr(org, 'saml'):
            org.saml.delete()
        org.delete()


def check_add_organization(user, title, organization=None):
    if Organization.objects.exists():
        if not organization:
            org = Organization.objects.filter(title=title).first()
        else:
            org = organization
        org.add_user(user)
    else:
        org = Organization.create_organization(created_by=user, title=title)
    user.active_organization = org
    user.save(update_fields=["active_organization"])

    return org.pk
