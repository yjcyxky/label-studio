"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging
from time import time

from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, reverse
from django.contrib import auth
from django.conf import settings
from django.core.exceptions import PermissionDenied
from rest_framework.authtoken.models import Token
from rest_framework_jwt.views import obtain_jwt_token

from users import forms
from core.utils.common import load_func
from users.functions import login
from organizations.functions import check_add_organization
from core.middleware import enforce_csrf_checks
from users.functions import proceed_registration
from organizations.models import Organization, OrganizationMember
from organizations.forms import OrganizationSignupForm


logger = logging.getLogger()


@login_required
def logout(request):
    auth.logout(request)
    if settings.HOSTNAME:
        redirect_url = settings.HOSTNAME
        if not redirect_url.endswith("/"):
            redirect_url += "/"
        response = redirect(redirect_url)
    response = redirect("/")
    response.delete_cookie("jwt_access_token")
    return response


@enforce_csrf_checks
def user_signup(request):
    """Sign up page"""
    user = request.user
    next_page = request.GET.get("next")
    token = request.GET.get("token")
    next_page = next_page if next_page else reverse("projects:project-index")
    user_form = forms.UserSignupForm()
    organization_form = OrganizationSignupForm()

    if user.is_authenticated:
        return redirect(next_page)

    # make a new user
    if request.method == "POST":
        organization_pk = request.POST.get("organization")
        if organization_pk:
            organization = Organization.objects.get(pk=organization_pk)
        else:
            organization = Organization.objects.first()

        if settings.DISABLE_SIGNUP_WITHOUT_LINK is True:
            if not (token and organization and token == organization.token):
                raise PermissionDenied()
        else:
            if token and organization and token != organization.token:
                raise PermissionDenied()

        user_form = forms.UserSignupForm(request.POST)
        # Don't need to create organization
        # organization_form = OrganizationSignupForm(request.POST)

        if user_form.is_valid():
            redirect_response = proceed_registration(
                request, user_form, organization, next_page
            )
            if redirect_response:
                return redirect_response

    return render(
        request,
        "users/user_signup.html",
        {
            "user_form": user_form,
            "organization_form": organization_form,
            "next": next_page,
            "token": token,
            "organizations": Organization.objects.all(),
        },
    )


@enforce_csrf_checks
def user_login(request):
    """Login page"""
    user = request.user
    next_page = request.GET.get("next")
    next_page = next_page if next_page else reverse("projects:project-index")
    login_form = load_func(settings.USER_LOGIN_FORM)
    form = login_form()

    if user.is_authenticated:
        return redirect(next_page)

    if request.method == "POST":
        organization_pk = request.POST.get("organization")
        form = login_form(request.POST)
        if form.is_valid():
            user = form.cleaned_data["user"]
            login(request, user, backend="django.contrib.auth.backends.ModelBackend")
            if form.cleaned_data["persist_session"] is not True:
                # Set the session to expire when the browser is closed
                request.session["keep_me_logged_in"] = False
                request.session.set_expiry(0)

        print("User login: ", form, user, organization_pk)

        if user.is_authenticated:
            response = None
            # https://github.com/HumanSignal/label-studio/discussions/2459#discussioncomment-6720923
            # There is no organization for superuser
            if organization_pk:
                try:
                    org = OrganizationMember.find_by_user(
                        user, organization_pk
                    ).organization
                except OrganizationMember.DoesNotExist:
                    if user.is_superuser:
                        # Connect user to the organization if he is a superuser
                        org_member = OrganizationMember.objects.create(
                            user=user, organization_id=organization_pk
                        )
                        org = org_member.organization
                    else:
                        # Don't allow to login if user is not a member of this organization
                        logout(request)
                        raise PermissionDenied(
                            "User is not a member of this organization"
                        )
            else:
                org = None

            print("User login: %s", user, organization_pk, org)
            # If user is not a member of any organization, add him to the default one
            check_add_organization(user, "Default", organization=org)
            response = redirect(next_page)

            if response:
                jwt_response = obtain_jwt_token(request)
                jwt_access_token = jwt_response.data.get("token")
                print(
                    "JWT access token: ",
                    dir(jwt_response),
                    jwt_response.cookies,
                    jwt_response.data,
                )
                domain = settings.JWT_AUTH.get("JWT_AUTH_COOKIE_DOMAIN", None)
                max_age = (
                    settings.MAX_SESSION_AGE
                    if request.session.get("keep_me_logged_in", True)
                    else 0
                )
                response.set_cookie(
                    "jwt_access_token",
                    jwt_access_token,
                    httponly=False,
                    samesite="Lax",
                    domain=domain,
                    max_age=max_age,
                )
                return response

    return render(
        request,
        "users/user_login.html",
        {
            "form": form,
            "next": next_page,
            "organizations": Organization.objects.all(),
        },
    )


@login_required
def user_account(request):
    user = request.user

    if user.active_organization is None and "organization_pk" not in request.session:
        return redirect(reverse("main"))

    form = forms.UserProfileForm(instance=user)
    token = Token.objects.get(user=user)

    if request.method == "POST":
        form = forms.UserProfileForm(request.POST, instance=user)
        if form.is_valid():
            form.save()
            return redirect(reverse("user-account"))

    return render(
        request,
        "users/user_account.html",
        {"settings": settings, "user": user, "user_profile_form": form, "token": token},
    )
